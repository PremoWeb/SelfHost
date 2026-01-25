import { error } from '@sveltejs/kit';
import { getInstanceSettings } from '$lib/server/services/settings';
import { isGod, isSuperAdmin, canAccessResource } from '$lib/server/auth/permissions';
import { getAllCompanies, getCompaniesForUser, getCompanyById } from '$lib/server/services/companies';
import { getUserTeams } from '$lib/server/auth/session';
import { db } from '$lib/server/db/client';
import { users, teams, casbinRule, teamMembers, companyMembers } from '$lib/server/db/schema';
import { getEnforcer } from '$lib/server/auth/casbin';
import { eq, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

/**
 * Get the context user ID - the user whose permissions we should check
 * When impersonating, use the impersonated user
 * When viewing a team context, use the team owner
 * When viewing a company context, use the company owner
 * Otherwise, use the logged-in user
 */
async function getContextUserId(locals: App.Locals): Promise<string> {
	// If impersonating a user, use that user
	if (locals.isImpersonating && locals.impersonationType === 'user' && locals.user) {
		return locals.user.id;
	}

	// If viewing a team context, get the team owner (or first member if no owner)
	if (locals.team) {
		// Try to get owner first
		let [member] = await db
			.select({ userId: teamMembers.userId })
			.from(teamMembers)
			.where(and(
				eq(teamMembers.teamId, locals.team.id),
				eq(teamMembers.role, 'owner')
			))
			.limit(1);
		
		// If no owner, get first member
		if (!member) {
			[member] = await db
				.select({ userId: teamMembers.userId })
				.from(teamMembers)
				.where(eq(teamMembers.teamId, locals.team.id))
				.limit(1);
		}
		
		if (member) {
			return member.userId;
		}
	}

	// If viewing a company context, get the company owner
	if (locals.activeCompanyId) {
		const company = await getCompanyById(locals.activeCompanyId);
		if (company) {
			const [owner] = await db
				.select({ userId: companyMembers.userId })
				.from(companyMembers)
				.where(and(
					eq(companyMembers.companyId, company.id),
					eq(companyMembers.role, 'owner')
				))
				.limit(1);
			
			if (owner) {
				return owner.userId;
			}
		}
	}

	// Default to logged-in user
	return locals.user!.id;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const settings = await getInstanceSettings();
	
	// Get the context user ID (impersonated user, team owner, company owner, or logged-in user)
	const contextUserId = await getContextUserId(locals);
	
	// Check permissions based on context user, not logged-in user
	const isGodUser = await isGod(contextUserId);
	const isAdmin = await isSuperAdmin(contextUserId);

	// Only god and super admins can access management features
	const canManage = isGodUser || isAdmin;

	let allCompanies = null;
	let allUsers = null;
	let allTeams = null;
	let allRoles = null;
	let casbinPolicies = null;

	if (canManage) {
		// Get all companies (god sees all, others see their own)
		// Check if user has read access to companies (either via Casbin or company membership)
		let hasCompanyReadAccess = isGodUser;
		
		if (!hasCompanyReadAccess) {
			// Check Casbin for company:* read permission
			try {
				const enforcer = await getEnforcer();
				hasCompanyReadAccess = await enforcer.enforce(contextUserId, 'company:*', 'read');
			} catch (err) {
				// If Casbin check fails, fall back to checking company membership
				const userCompanies = await getCompaniesForUser(contextUserId);
				hasCompanyReadAccess = userCompanies.length > 0;
			}
		}
		
		if (hasCompanyReadAccess) {
			if (isGodUser) {
				allCompanies = await getAllCompanies();
			} else {
				allCompanies = await getCompaniesForUser(contextUserId);
			}
		} else {
			// User doesn't have read access to companies
			allCompanies = [];
		}

		// Get all users (god only, and only show the context user themselves)
		if (isGodUser) {
			allUsers = await db.query.users.findMany({
				orderBy: (users, { asc }) => [asc(users.createdAt)]
			});
		} else {
			// Non-god users only see themselves
			const contextUser = await db.query.users.findFirst({
				where: eq(users.id, contextUserId)
			});
			allUsers = contextUser ? [contextUser] : [];
		}

		// Get all teams (god sees all, others see their own)
		if (isGodUser) {
			allTeams = await db.query.teams.findMany({
				with: {
					members: {
						with: {
							user: true
						}
					}
				},
				orderBy: (teams, { asc }) => [asc(teams.name)]
			});
		} else {
			// Regular users see their teams
			const userTeams = await getUserTeams(contextUserId);
			allTeams = userTeams.map((t) => t.team);
		}

		// Get Casbin policies (god only)
		if (isGodUser) {
			casbinPolicies = await db.select().from(casbinRule);
			const enforcer = await getEnforcer();
			
			// Get all unique roles from grouping policies
			const allGroupingPolicies = casbinPolicies.filter((p) => p.ptype === 'g');
			const roleSet = new Set<string>();
			for (const policy of allGroupingPolicies) {
				if (policy.v1) {
					roleSet.add(policy.v1);
				}
			}
			allRoles = Array.from(roleSet).sort();
		}
	}

	return {
		settings,
		isGod: isGodUser,
		isSuperAdmin: isAdmin,
		canManage,
		companies: allCompanies,
		users: allUsers,
		teams: allTeams,
		roles: allRoles,
		casbinPolicies
	};
};
