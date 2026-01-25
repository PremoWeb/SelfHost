import { getSharedVariablesByTeam } from '$lib/server/services/variables';
import { requireAuth, requireTeam } from '$lib/server/auth/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);

	if (!locals.team) {
		return {
			variables: []
		};
	}

	const variables = await getSharedVariablesByTeam(locals.team.id);

	return {
		variables
	};
};
