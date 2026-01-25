import { requireAuth } from '$lib/server/auth/permissions';
import { getApplicationById } from '$lib/server/services/applications';
import { getEnvironmentVariables } from '$lib/server/services/environment-variables';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	await requireAuth(locals);

	const app = await getApplicationById(params.appId);
	if (!app) {
		throw error(404, 'Application not found');
	}

	const variables = await getEnvironmentVariables(app.id);

	return {
		app,
		variables
	};
};
