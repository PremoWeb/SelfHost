import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getUserTeams, setSessionTeam } from '$lib/server/auth/session';
import { isSuperAdmin, isGod } from '$lib/server/auth/permissions';
import { getAllTeams } from '$lib/server/services/teams';
import { getAllCompanies, getCompaniesForUser, getCompanyById } from '$lib/server/services/companies';
import { db } from '$lib/server/db/client';
import { users } from '$lib/server/db/schema';
import type { User, Team } from '$lib/server/db/schema';
import { performance } from 'perf_hooks';

/**
 * Protected layout - requires authentication
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const startTime = performance.now();
	
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	// Parallelize permission checks
	const [isAdmin, isGodUser] = await Promise.all([
		isSuperAdmin(locals.user.id),
		isGod(locals.user.id)
	]);

	// Parallelize data fetching based on user type
	const dataPromises: Promise<any>[] = [];
	
	// Teams and companies can be fetched in parallel
	if (isGodUser) {
		dataPromises.push(
			getAllTeams().then(allTeams => allTeams.map((t) => ({ ...t, role: 'god' as const }))),
			getAllCompanies(),
			// Users for impersonation (God only)
			db.query.users.findMany({
				orderBy: (users, { asc }) => [asc(users.createdAt)],
				limit: 50
			})
		);
	} else {
		dataPromises.push(
			getUserTeams(locals.user.id).then(userTeams => userTeams.map((t) => ({ ...t.team, role: t.role }))),
			getCompaniesForUser(locals.user.id),
			Promise.resolve([]) // No users for non-god users
		);
	}

	// Active company fetch (only if needed)
	if (locals.activeCompanyId) {
		dataPromises.push(getCompanyById(locals.activeCompanyId));
	} else {
		dataPromises.push(Promise.resolve(null));
	}

	// Wait for all data in parallel
	const [teams, companies, allUsers, activeCompany] = await Promise.all(dataPromises);

	const endTime = performance.now();
	const duration = endTime - startTime;
	
	// Slow loads are silently handled

	return {
		user: locals.user as User,
		team: locals.team as Team | null,
		activeCompany: activeCompany || null,
		teams: teams || [],
		companies: companies || [],
		users: allUsers || [],
		isSuperAdmin: isAdmin,
		isGod: isGodUser,
		isImpersonating: locals.isImpersonating || false,
		impersonatedBy: locals.impersonatedBy || null,
		impersonationType: locals.impersonationType || null,
		impersonationEntity: locals.impersonationEntity || null
	};
};



