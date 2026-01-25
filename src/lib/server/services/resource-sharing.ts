import { db } from '../db/client';
import { companyResourceShares, companies, users } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';
import type { NewCompanyResourceShare } from '../db/schema';

export type ResourceType = 'server' | 'domain' | 'vps_provider' | 'private_key' | 'api_token' | 'destination' | 'source' | 's3_storage' | 'shared_variable';

export interface ResourceSharePermissions {
	read?: boolean;
	manage?: boolean;
	create_with_approval?: boolean;
}

/**
 * Share a resource with another company
 */
export async function shareResource(
	resourceType: ResourceType,
	resourceId: string,
	ownerCompanyId: string,
	sharedWithCompanyId: string,
	permissions: ResourceSharePermissions
) {
	// Check if share already exists
	const existing = await db
		.select()
		.from(companyResourceShares)
		.where(
			and(
				eq(companyResourceShares.resourceType, resourceType),
				eq(companyResourceShares.resourceId, resourceId),
				eq(companyResourceShares.ownerCompanyId, ownerCompanyId),
				eq(companyResourceShares.sharedWithCompanyId, sharedWithCompanyId)
			)
		)
		.limit(1);

	if (existing.length > 0) {
		// Update existing share
		const [share] = await db
			.update(companyResourceShares)
			.set({
				permissions,
				status: 'pending', // Reset to pending if updating
				updatedAt: new Date()
			})
			.where(
				and(
					eq(companyResourceShares.resourceType, resourceType),
					eq(companyResourceShares.resourceId, resourceId),
					eq(companyResourceShares.ownerCompanyId, ownerCompanyId),
					eq(companyResourceShares.sharedWithCompanyId, sharedWithCompanyId)
				)
			)
			.returning();
		return share;
	}

	// Create new share request
	const [share] = await db
		.insert(companyResourceShares)
		.values({
			resourceType,
			resourceId,
			ownerCompanyId,
			sharedWithCompanyId,
			permissions,
			status: 'pending'
		})
		.returning();

	return share;
}

/**
 * Approve a resource share request
 */
export async function approveResourceShare(shareId: string, approverId: string) {
	const [share] = await db
		.update(companyResourceShares)
		.set({
			status: 'approved',
			approvedBy: approverId,
			approvedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(companyResourceShares.id, shareId))
		.returning();

	return share;
}

/**
 * Reject a resource share request
 */
export async function rejectResourceShare(shareId: string) {
	const [share] = await db
		.update(companyResourceShares)
		.set({
			status: 'rejected',
			updatedAt: new Date()
		})
		.where(eq(companyResourceShares.id, shareId))
		.returning();

	return share;
}

/**
 * Get all shared resources for a company (incoming shares)
 */
export async function getSharedResources(companyId: string, status?: 'pending' | 'approved' | 'rejected') {
	const query = db
		.select({
			share: companyResourceShares,
			ownerCompany: companies
		})
		.from(companyResourceShares)
		.innerJoin(companies, eq(companyResourceShares.ownerCompanyId, companies.id))
		.where(eq(companyResourceShares.sharedWithCompanyId, companyId));

	if (status) {
		query.where(and(eq(companyResourceShares.sharedWithCompanyId, companyId), eq(companyResourceShares.status, status)));
	}

	return await query;
}

/**
 * Get all resource shares for a resource (outgoing shares)
 */
export async function getResourceShares(resourceType: ResourceType, resourceId: string) {
	return await db
		.select({
			share: companyResourceShares,
			sharedWithCompany: companies,
			approvedByUser: users
		})
		.from(companyResourceShares)
		.innerJoin(companies, eq(companyResourceShares.sharedWithCompanyId, companies.id))
		.leftJoin(users, eq(companyResourceShares.approvedBy, users.id))
		.where(
			and(eq(companyResourceShares.resourceType, resourceType), eq(companyResourceShares.resourceId, resourceId))
		);
}

/**
 * Get all shares owned by a company (outgoing shares)
 */
export async function getOwnedResourceShares(companyId: string, status?: 'pending' | 'approved' | 'rejected') {
	const query = db
		.select({
			share: companyResourceShares,
			sharedWithCompany: companies
		})
		.from(companyResourceShares)
		.innerJoin(companies, eq(companyResourceShares.sharedWithCompanyId, companies.id))
		.where(eq(companyResourceShares.ownerCompanyId, companyId));

	if (status) {
		query.where(and(eq(companyResourceShares.ownerCompanyId, companyId), eq(companyResourceShares.status, status)));
	}

	return await query;
}

/**
 * Remove a resource share
 */
export async function removeResourceShare(shareId: string) {
	await db.delete(companyResourceShares).where(eq(companyResourceShares.id, shareId));
}

/**
 * Check if a company has access to a resource (via sharing)
 */
export async function hasResourceAccess(
	companyId: string,
	resourceType: ResourceType,
	resourceId: string,
	permission: 'read' | 'manage' | 'create'
): Promise<boolean> {
	const [share] = await db
		.select()
		.from(companyResourceShares)
		.where(
			and(
				eq(companyResourceShares.resourceType, resourceType),
				eq(companyResourceShares.resourceId, resourceId),
				eq(companyResourceShares.sharedWithCompanyId, companyId),
				eq(companyResourceShares.status, 'approved')
			)
		)
		.limit(1);

	if (!share) return false;

	const permissions = share.permissions as ResourceSharePermissions;

	switch (permission) {
		case 'read':
			return permissions.read === true;
		case 'manage':
			return permissions.manage === true;
		case 'create':
			return permissions.create_with_approval === true;
		default:
			return false;
	}
}
