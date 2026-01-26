import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getUserTeams, setSessionTeam } from '$lib/server/auth/session';
import { isSuperAdmin, isGod } from '$lib/server/auth/permissions';
import { getAllTeams } from '$lib/server/services/teams';
import { getAllCompanies, getCompaniesForUser, getCompanyById } from '$lib/server/services/companies';
import { getInstanceSettings } from '$lib/server/services/settings';
import { db } from '$lib/server/db/client';
import { users } from '$lib/server/db/schema';
import type { User, Team } from '$lib/server/db/schema';
import { performance } from 'perf_hooks';

/**
 * Protected layout - requires authentication
 */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const startTime = performance.now();
	
	// Check website mode FIRST - before ANY other logic
	const instanceSettings = await getInstanceSettings();
	const websiteMode = !!instanceSettings?.websiteMode;
	
	// Public routes that should be accessible without authentication when website mode is on
	const publicRoutes = ['/docs', '/sponsors'];
	const isPublicRoute = publicRoutes.some(route => url.pathname.startsWith(route));
	
	// (app) route group is ONLY for authenticated users
	// The root "/" page handles both landing and dashboard based on authentication
	// This layout only applies to authenticated routes (not "/")
	// Require authentication for all routes in (app) group, EXCEPT public routes when website mode is on
	if (!locals.user) {
		// If website mode is on and this is a public route, allow access without authentication
		if (websiteMode && isPublicRoute) {
			// Return minimal data for public routes
			return {
				user: null,
				team: null,
				activeCompany: null,
				teams: [],
				companies: [],
				users: [],
				isSuperAdmin: false,
				isGod: false,
				isImpersonating: false,
				impersonatedBy: null,
				impersonationType: null,
				impersonationEntity: null,
				websiteMode: true
			};
		}
		
		// Not a public route or website mode is off - require authentication
		if (websiteMode) {
			// Website mode is on - redirect to "/" which will show landing page
			throw redirect(303, '/');
		} else {
			// Website mode is off - redirect to login
			throw redirect(303, '/login');
		}
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
		impersonationEntity: locals.impersonationEntity || null,
		websiteMode: instanceSettings?.websiteMode || false
	};
};



