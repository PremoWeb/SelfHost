import { getDestinationsByTeam } from '$lib/server/services/destinations';
import { getServersByTeam } from '$lib/server/services/servers';
import { requireAuth } from '$lib/server/auth/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);

	// Super admins without a team get empty lists
	if (!locals.team) {
		return {
			destinations: [],
			servers: []
		};
	}

	const [destinations, servers] = await Promise.all([
		getDestinationsByTeam(locals.team.id),
		getServersByTeam(locals.team.id)
	]);

	return {
		destinations,
		servers
	};
};
