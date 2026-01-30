import type { LayoutLoad } from './$types';
import { authStore } from '$lib/stores/auth';
import { authApi } from '$lib/api/resources/auth';
import { teamsApi } from '$lib/api/resources/teams';
import { companiesApi } from '$lib/api/resources/companies';
import { usersApi } from '$lib/api/resources/users';

export const load: LayoutLoad = async ({ data }) => {
	// Load real session from Zig API (SPA: no server load, so we fetch client-side)
	const session = await authApi.getSession();

	if (session?.user) {
		const user = {
			id: session.user.id,
			name: session.user.name,
			email: session.user.email,
			emailVerifiedAt: null as Date | null,
			createdAt: new Date(),
			updatedAt: new Date()
		};
		// Only pass a team when session has an active team (so "Return to God Mode" clears it and banner hides)
		const team = session.team ?? null;
		authStore.setUser(user as any, team as any);
		// Fetch teams, companies, and (for God) users from Zig — like SvelteKit layout
		const isGod = session.user.isGod ?? false;
		const [teams, companies, users] = await Promise.all([
			teamsApi.getTeams(),
			companiesApi.getCompanies(),
			isGod ? usersApi.getUsers() : Promise.resolve([])
		]);
		const teamsList = teams.length > 0 ? teams : (session.team ? [session.team] : []);
		return {
			user,
			team,
			teams: teamsList,
			companies,
			users,
			activeCompany: data?.activeCompany ?? null,
			isGod,
			isImpersonating: session.isImpersonating ?? false,
			impersonationType: session.impersonationType ?? null,
			impersonatedBy: session.impersonatedBy ?? null,
			shouldUseAppLayout: true
		};
	}

	// No session: leave auth empty; root layout can redirect (app) to /login
	authStore.setLoading(false);
	return {
		user: null,
		team: null,
		teams: [],
		companies: [],
		users: [],
		activeCompany: null,
		isGod: false,
		isImpersonating: false,
		impersonationType: null,
		impersonatedBy: null,
		shouldUseAppLayout: true
	};
};
