import { error } from '@sveltejs/kit';
import { getApiTokensByTeam } from '$lib/server/services/api-tokens';
import { requireAuth, isGod } from '$lib/server/auth/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);
	
	// God users can access this page without a team
	if (!locals.team && !(await isGod(locals.user!.id))) {
		throw error(400, 'Team required');
	}

	const tokens = locals.team ? await getApiTokensByTeam(locals.team.id) : [];

	return {
		apiTokens: tokens
	};
};
