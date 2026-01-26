import type { LayoutServerLoad } from './$types';
import { getUserTeams, setSessionTeam } from '$lib/server/auth/session';
import { isSuperAdmin, isGod } from '$lib/server/auth/permissions';
import { getAllTeams } from '$lib/server/services/teams';
import { getAllCompanies, getCompaniesForUser, getCompanyById } from '$lib/server/services/companies';
import { getInstanceSettings } from '$lib/server/services/settings';
import { db } from '$lib/server/db/client';
import { users } from '$lib/server/db/schema';
import type { User, Team } from '$lib/server/db/schema';

/**
 * Root layout - loads data for both authenticated and unauthenticated users
 * The layout component will conditionally render app layout or public layout
 */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const instanceSettings = await getInstanceSettings();
	const websiteMode = !!instanceSettings?.websiteMode;
	const isRootPath = url.pathname === '/';
	// Check if this is a route inside (app) group (not root "/")
	const isAppRoute = !isRootPath && locals.user;
	
	// If not authenticated and on root with website mode, return minimal data for landing
	if (!locals.user && isRootPath && websiteMode) {
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
			websiteMode: true,
			shouldUseAppLayout: false
		};
	}
	
	// If authenticated, load app layout data
	if (locals.user) {
		const [isAdmin, isGodUser] = await Promise.all([
			isSuperAdmin(locals.user.id),
			isGod(locals.user.id)
		]);

		const dataPromises: Promise<any>[] = [];
		
		if (isGodUser) {
			dataPromises.push(
				getAllTeams().then(allTeams => allTeams.map((t) => ({ ...t, role: 'god' as const }))),
				getAllCompanies(),
				db.query.users.findMany({
					orderBy: (users, { asc }) => [asc(users.createdAt)],
					limit: 50
				})
			);
		} else {
			dataPromises.push(
				getUserTeams(locals.user.id).then(userTeams => userTeams.map((t) => ({ ...t.team, role: t.role }))),
				getCompaniesForUser(locals.user.id),
				Promise.resolve([])
			);
		}

		if (locals.activeCompanyId) {
			dataPromises.push(getCompanyById(locals.activeCompanyId));
		} else {
			dataPromises.push(Promise.resolve(null));
		}

		const [teams, companies, allUsers, activeCompany] = await Promise.all(dataPromises);

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
			websiteMode: websiteMode || false,
			shouldUseAppLayout: isRootPath, // Only apply app layout wrapper for root "/" - routes inside (app) use their own layout
			isAppRoute: isAppRoute
		};
	}
	
	// Not authenticated and not showing landing - return minimal data
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
		websiteMode: websiteMode || false,
		shouldUseAppLayout: false,
		isAppRoute: false
	};
};
