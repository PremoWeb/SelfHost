import { json } from '@sveltejs/kit';
import { createApplication } from '$lib/server/services/applications';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const { name, description, environmentId, destinationId, sourceId, gitRepository, gitBranch, buildPack } = await request.json();

	if (!name || !environmentId) {
		return json({ message: 'Name and Environment ID are required' }, { status: 400 });
	}

	const app = await createApplication({
		name,
		description,
		environmentId,
		destinationId,
		sourceId,
		gitRepository,
		gitBranch: gitBranch || 'main',
		buildPack: buildPack || 'nixpacks',
		status: 'stopped'
	});

	return json({ data: app }, { status: 201 });
};
