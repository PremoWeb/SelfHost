import { db } from '../db/client';
import { companies, companyMembers, users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { NewCompany, NewCompanyMember } from '../db/schema';
import { getEnforcer } from '../auth/casbin';

/**
 * Create a new company
 * The creator becomes the owner and gets company_owner role
 */
export async function createCompany(userId: string, data: { name: string; description?: string; slug?: string }) {
	const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

	const [company] = await db
		.insert(companies)
		.values({
			name: data.name,
			description: data.description,
			slug,
			createdBy: userId,
			settings: {}
		})
		.returning();

	// Add creator as owner
	await db.insert(companyMembers).values({
		companyId: company.id,
		userId,
		role: 'owner'
	});

	// Assign company_owner role via Casbin
	const enforcer = await getEnforcer();
	await enforcer.addGroupingPolicy(userId, 'company_owner');
	await enforcer.savePolicy();

	return company;
}

/**
 * Get company by ID
 */
export async function getCompanyById(id: string) {
	const company = await db.query.companies.findFirst({
		where: eq(companies.id, id),
		with: {
			createdBy: true,
			members: {
				with: {
					user: true
				}
			}
		}
	});
	return company;
}

/**
 * Get company by slug
 */
export async function getCompanyBySlug(slug: string) {
	const company = await db.query.companies.findFirst({
		where: eq(companies.slug, slug),
		with: {
			createdBy: true,
			members: {
				with: {
					user: true
				}
			}
		}
	});
	return company;
}

/**
 * Get all companies a user is a member of
 */
export async function getCompaniesForUser(userId: string) {
	const userCompanies = await db
		.select({
			company: companies,
			member: companyMembers
		})
		.from(companyMembers)
		.innerJoin(companies, eq(companyMembers.companyId, companies.id))
		.where(eq(companyMembers.userId, userId));

	return userCompanies.map((uc) => ({
		...uc.company,
		role: uc.member.role
	}));
}

/**
 * Get all companies (God mode only)
 */
export async function getAllCompanies() {
	return await db.query.companies.findMany({
		with: {
			createdBy: true,
			members: {
				with: {
					user: true
				}
			}
		},
		orderBy: (companies, { asc }) => [asc(companies.name)]
	});
}

/**
 * Update company
 */
export async function updateCompany(
	companyId: string,
	data: { name?: string; description?: string; slug?: string; settings?: Record<string, any> }
) {
	const updateData: any = {};
	if (data.name !== undefined) updateData.name = data.name;
	if (data.description !== undefined) updateData.description = data.description;
	if (data.slug !== undefined) updateData.slug = data.slug;
	if (data.settings !== undefined) updateData.settings = data.settings;
	updateData.updatedAt = new Date();

	const [company] = await db.update(companies).set(updateData).where(eq(companies.id, companyId)).returning();
	return company;
}

/**
 * Delete company
 */
export async function deleteCompany(companyId: string) {
	await db.delete(companies).where(eq(companies.id, companyId));
}

/**
 * Add a member to a company
 */
export async function addCompanyMember(companyId: string, userId: string, role: 'owner' | 'admin' | 'member' = 'member') {
	// Check if member already exists
	const existing = await db
		.select()
		.from(companyMembers)
		.where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
		.limit(1);

	if (existing.length > 0) {
		// Update existing member
		const [member] = await db
			.update(companyMembers)
			.set({ role })
			.where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
			.returning();
		return member;
	}

	// Add new member
	const [member] = await db
		.insert(companyMembers)
		.values({
			companyId,
			userId,
			role
		})
		.returning();

	// Assign Casbin role if owner
	if (role === 'owner') {
		const enforcer = await getEnforcer();
		await enforcer.addGroupingPolicy(userId, 'company_owner');
		await enforcer.savePolicy();
	}

	return member;
}

/**
 * Remove a member from a company
 */
export async function removeCompanyMember(companyId: string, userId: string) {
	// Remove Casbin role if owner
	const [member] = await db
		.select()
		.from(companyMembers)
		.where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
		.limit(1);

	if (member?.role === 'owner') {
		const enforcer = await getEnforcer();
		await enforcer.removeGroupingPolicy(userId, 'company_owner');
		await enforcer.savePolicy();
	}

	await db
		.delete(companyMembers)
		.where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)));
}

/**
 * Get company members
 */
export async function getCompanyMembers(companyId: string) {
	return await db
		.select({
			member: companyMembers,
			user: users
		})
		.from(companyMembers)
		.innerJoin(users, eq(companyMembers.userId, users.id))
		.where(eq(companyMembers.companyId, companyId));
}

/**
 * Get default company for resource assignment
 * Returns the first company if any exist, otherwise returns null (indicating god user ownership)
 */
export async function getDefaultCompanyForResource(): Promise<string | null> {
	const allCompanies = await db.query.companies.findMany({
		orderBy: (companies, { asc }) => [asc(companies.createdAt)],
		limit: 1
	});
	
	return allCompanies.length > 0 ? allCompanies[0].id : null;
}

/**
 * Get default owner for resource assignment
 * Returns company ID if companies exist, otherwise returns null (for god user)
 */
export async function getDefaultResourceOwner(): Promise<{ ownerType: 'company' | 'individual'; ownerId: string } | null> {
	const companyId = await getDefaultCompanyForResource();
	
	if (companyId) {
		return { ownerType: 'company', ownerId: companyId };
	}
	
	// If no companies exist, return null to indicate god user ownership
	// The caller should handle this case appropriately
	return null;
}
