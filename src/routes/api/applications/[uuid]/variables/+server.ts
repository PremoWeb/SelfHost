import { json } from '@sveltejs/kit';
import { getEnvironmentVariables, createEnvironmentVariable } from '$lib/server/services/environment-variables';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const variables = await getEnvironmentVariables(params.uuid);
	return json(variables);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const { key, value, isBuildTime, isPreview } = await request.json();

	if (!key || !value) {
		return json({ message: 'Key and Value are required' }, { status: 400 });
	}

	const variable = await createEnvironmentVariable({
		key,
		value,
		isBuildTime: isBuildTime || false,
		isPreview: isPreview || false,
		applicationId: params.uuid
	});

	return json({ data: variable }, { status: 201 });
};
