import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { clientsService } from '$lib/server/services/clients';
import { requireAuth, isGod } from '$lib/server/auth/permissions';

export const load: PageServerLoad = async ({ params, locals }) => {
	await requireAuth(locals);
	
	// God users can access this page but won't have a team
	// Regular users need a team
	if (!locals.team && !(await isGod(locals.user!.id))) {
		throw error(400, 'Team required');
	}

	const client = locals.team ? await clientsService.getClientWithProjects(params.id, locals.team.id) : null;

	if (!client) {
		throw error(404, 'Client not found');
	}

	return {
		client
	};
};
