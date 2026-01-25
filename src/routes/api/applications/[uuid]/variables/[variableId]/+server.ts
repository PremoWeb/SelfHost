import { json } from '@sveltejs/kit';
import { updateEnvironmentVariable, deleteEnvironmentVariable } from '$lib/server/services/environment-variables';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const { key, value, isBuildTime, isPreview } = await request.json();
	
	const variable = await updateEnvironmentVariable(params.variableId, params.uuid, {
		key,
		value,
		isBuildTime,
		isPreview
	});

	if (!variable) {
		return json({ message: 'Variable not found' }, { status: 404 });
	}

	return json({ data: variable });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	await deleteEnvironmentVariable(params.variableId, params.uuid);

	return json({ success: true });
};
