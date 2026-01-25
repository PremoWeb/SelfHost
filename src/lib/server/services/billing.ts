import { db } from '../db/client';
import { billingProfiles, companies, projects } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { NewBillingProfile } from '../db/schema';

/**
 * Create a billing profile
 */
export async function createBillingProfile(data: {
	name: string;
	companyId?: string | null;
	billingEmail?: string;
	billingAddress?: Record<string, any>;
	paymentMethod?: Record<string, any>;
	settings?: Record<string, any>;
}) {
	const [profile] = await db
		.insert(billingProfiles)
		.values({
			name: data.name,
			companyId: data.companyId || null,
			billingEmail: data.billingEmail,
			billingAddress: data.billingAddress || {},
			paymentMethod: data.paymentMethod || {},
			settings: data.settings || {}
		})
		.returning();

	return profile;
}

/**
 * Get billing profile by ID
 */
export async function getBillingProfile(id: string) {
	return await db.query.billingProfiles.findFirst({
		where: eq(billingProfiles.id, id),
		with: {
			company: true,
			projects: true
		}
	});
}

/**
 * Get billing profiles for a company
 */
export async function getBillingProfilesForCompany(companyId: string) {
	return await db.query.billingProfiles.findMany({
		where: eq(billingProfiles.companyId, companyId),
		with: {
			projects: true
		},
		orderBy: (profiles, { asc }) => [asc(profiles.name)]
	});
}

/**
 * Get all billing profiles (God mode only)
 */
export async function getAllBillingProfiles() {
	return await db.query.billingProfiles.findMany({
		with: {
			company: true,
			projects: true
		},
		orderBy: (profiles, { asc }) => [asc(profiles.name)]
	});
}

/**
 * Update billing profile
 */
export async function updateBillingProfile(
	id: string,
	data: {
		name?: string;
		billingEmail?: string;
		billingAddress?: Record<string, any>;
		paymentMethod?: Record<string, any>;
		settings?: Record<string, any>;
	}
) {
	const updateData: any = {};
	if (data.name !== undefined) updateData.name = data.name;
	if (data.billingEmail !== undefined) updateData.billingEmail = data.billingEmail;
	if (data.billingAddress !== undefined) updateData.billingAddress = data.billingAddress;
	if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
	if (data.settings !== undefined) updateData.settings = data.settings;
	updateData.updatedAt = new Date();

	const [profile] = await db.update(billingProfiles).set(updateData).where(eq(billingProfiles.id, id)).returning();
	return profile;
}

/**
 * Delete billing profile
 */
export async function deleteBillingProfile(id: string) {
	await db.delete(billingProfiles).where(eq(billingProfiles.id, id));
}

/**
 * Link a project to a billing profile
 */
export async function linkProjectToBilling(projectId: string, billingProfileId: string) {
	const [project] = await db
		.update(projects)
		.set({ billingProfileId, updatedAt: new Date() })
		.where(eq(projects.id, projectId))
		.returning();

	return project;
}

/**
 * Unlink a project from its billing profile
 */
export async function unlinkProjectFromBilling(projectId: string) {
	const [project] = await db
		.update(projects)
		.set({ billingProfileId: null, updatedAt: new Date() })
		.where(eq(projects.id, projectId))
		.returning();

	return project;
}
