import { error } from '@sveltejs/kit';
import { getEnvironmentById } from '$lib/server/services/environments';
import { getApplicationsByEnvironment } from '$lib/server/services/applications';
import { getSourcesByTeam } from '$lib/server/services/sources';
import { getDestinationsByTeam } from '$lib/server/services/destinations';
import { requireAuth, isGod } from '$lib/server/auth/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	await requireAuth(locals);
	
	// God users can access environments, others need a team
	if (!locals.team && !(await isGod(locals.user!.id))) {
		throw error(400, 'Team required to view environment');
	}

	const environment = await getEnvironmentById(params.environmentUuid);
	if (!environment) {
		throw error(404, 'Environment not found');
	}

	if (environment.projectId !== params.uuid) {
		throw error(404, 'Environment not found in this project');
	}

	const applications = await getApplicationsByEnvironment(environment.id);
	const sources = locals.team ? await getSourcesByTeam(locals.team.id) : [];
	const destinations = locals.team ? await getDestinationsByTeam(locals.team.id) : [];

	return {
		environment,
		applications,
		sources,
		destinations
	};
};
