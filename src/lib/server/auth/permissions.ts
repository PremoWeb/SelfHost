import { error } from '@sveltejs/kit';
import { getEnforcer } from './casbin';
import { db } from '../db/client';
import { users, companyMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Check if a user is God (first user, overrules everything)
 */
export async function isGod(userId: string): Promise<boolean> {
	if (!userId) return false;
	
	try {
		const [user] = await db.select({ isGod: users.isGod }).from(users).where(eq(users.id, userId)).limit(1);
		if (!user) return false;
		// Use truthy check instead of strict === true to handle both boolean and number (1/0) cases
		return !!user.isGod;
	} catch (err) {
		return false;
	}
}

/**
 * Check if a user has the super_admin role
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
	try {
		const enforcer = await getEnforcer();
		// Check if user has super_admin role via grouping policy
		// g(user_id, "super_admin") means user has super_admin role
		const roles = await enforcer.getRolesForUser(userId);
		return roles.includes('super_admin');
	} catch (error) {
		return false;
	}
}

/**
 * Check if a user is a company owner
 */
export async function isCompanyOwner(userId: string, companyId: string): Promise<boolean> {
	try {
		const [member] = await db
			.select()
			.from(companyMembers)
			.where(and(eq(companyMembers.userId, userId), eq(companyMembers.companyId, companyId)))
			.limit(1);
		return member?.role === 'owner';
	} catch (err) {
		return false;
	}
}

/**
 * Check if a user is a company admin
 */
export async function isCompanyAdmin(userId: string, companyId: string): Promise<boolean> {
	try {
		const [member] = await db
			.select()
			.from(companyMembers)
			.where(and(eq(companyMembers.userId, userId), eq(companyMembers.companyId, companyId)))
			.limit(1);
		return member?.role === 'admin' || member?.role === 'owner';
	} catch (err) {
		return false;
	}
}

/**
 * Check if a user can access a resource
 * God can access everything, company owners can access their company's resources
 */
export async function canAccessResource(
	userId: string | undefined,
	resourceType: string,
	resourceId: string
): Promise<boolean> {
	if (!userId) return false;

	// God can access everything
	if (await isGod(userId)) return true;

	// Check Casbin policies
	try {
		const enforcer = await getEnforcer();
		const allowed = await enforcer.enforce(userId, `${resourceType}:${resourceId}`, 'read');
		if (allowed) return true;
	} catch (err) {
		// Silently fail
	}

	// TODO: Check company ownership and resource sharing
	// This will be implemented when resource services are updated

	return false;
}

/**
 * Check if a user can create a resource for a company
 */
export async function canCreateResource(
	userId: string | undefined,
	resourceType: string,
	companyId?: string | null
): Promise<boolean> {
	if (!userId) return false;

	// God can create anything
	if (await isGod(userId)) return true;

	// If companyId is provided, check if user is company owner/admin
	if (companyId) {
		if (await isCompanyAdmin(userId, companyId)) return true;
	}

	// Check Casbin policies
	try {
		const enforcer = await getEnforcer();
		const allowed = await enforcer.enforce(userId, `${resourceType}/*`, 'create');
		if (allowed) return true;
	} catch (err) {
		// Silently fail
	}

	return false;
}

/**
 * Check if user is authorized (has team OR is super_admin OR is god)
 * God and super admins bypass team requirements
 */
export async function isAuthorized(userId: string | undefined, teamId: string | null | undefined): Promise<boolean> {
	if (!userId) return false;
	
	// God is always authorized
	if (await isGod(userId)) return true;
	
	// If user has a team, they're authorized
	if (teamId) return true;
	
	// Super admins are always authorized even without a team
	return await isSuperAdmin(userId);
}

/**
 * Require authorization - throws error if not authorized
 * Use in page server loads
 */
export async function requireAuth(locals: App.Locals): Promise<void> {
	if (!locals.user) {
		throw error(401, 'Unauthorized: No user in locals');
	}
	
	const userId = locals.user.id;
	const teamId = locals.team?.id;
	
	// Check if user is God first (most permissive)
	const godCheck = await isGod(userId);
	if (godCheck) {
		return; // God users are always authorized
	}
	
	// Check if user has a team
	if (teamId) {
		return; // Users with teams are authorized
	}
	
	// Check if user is super admin
	const superAdminCheck = await isSuperAdmin(userId);
	if (superAdminCheck) {
		return; // Super admins are authorized even without a team
	}
	
	// User is not authorized
	throw error(401, `Unauthorized: Session may have expired or team context is missing. (User: ${userId}, Team: ${teamId || 'none'})`);
}

/**
 * Require authorization for API routes - throws error if not authorized
 * Use in API route handlers (same as requireAuth, but kept for semantic clarity)
 */
export async function requireApiAuth(locals: App.Locals): Promise<void> {
	await requireAuth(locals);
}

/**
 * Require team - throws error if no team (allows god users to bypass)
 * Use when team context is absolutely required for non-god users
 */
export async function requireTeam(locals: App.Locals): Promise<void> {
	if (!locals.team && locals.user && !(await isGod(locals.user.id))) {
		throw error(400, 'Team required');
	}
}

/**
 * Check if user can bypass team requirements (god or super_admin)
 */
export async function canBypassTeam(userId: string | undefined): Promise<boolean> {
	if (!userId) return false;
	return (await isGod(userId)) || (await isSuperAdmin(userId));
}

/**
 * Require team, but allow god/super_admin to bypass
 * Returns true if team is present or user can bypass, false otherwise
 */
export async function requireTeamOrBypass(locals: App.Locals): Promise<boolean> {
	if (locals.team) return true;
	if (locals.user && await canBypassTeam(locals.user.id)) return true;
	return false;
}
