import { error } from '@sveltejs/kit';
import { getTeamMembers } from '$lib/server/services/teams';
import { requireAuth, isGod } from '$lib/server/auth/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);
	
	// God users can access this page but won't have a team
	// Regular users need a team
	if (!locals.team && !(await isGod(locals.user!.id))) {
		throw error(400, 'Team required');
	}

	const members = locals.team ? await getTeamMembers(locals.team.id) : [];

	return {
		members
	};
};
