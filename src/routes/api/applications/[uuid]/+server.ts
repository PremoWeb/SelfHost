import { json } from '@sveltejs/kit';
import { getApplicationById, updateApplication, deleteApplication } from '$lib/server/services/applications';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const app = await getApplicationById(params.uuid);
	if (!app) {
		return json({ message: 'Application not found' }, { status: 404 });
	}

	return json(app);
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const app = await getApplicationById(params.uuid);
	if (!app) {
		return json({ message: 'Application not found' }, { status: 404 });
	}

	const data = await request.json();
	const updatedApp = await updateApplication(params.uuid, data);

	return json({ data: updatedApp });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const app = await getApplicationById(params.uuid);
	if (!app) {
		return json({ message: 'Application not found' }, { status: 404 });
	}

	await deleteApplication(params.uuid);

	return json({ success: true });
};
