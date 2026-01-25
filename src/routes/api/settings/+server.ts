import { json } from '@sveltejs/kit';
import { getInstanceSettings, updateInstanceSettings } from '$lib/server/services/settings';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const settings = await getInstanceSettings();
	return json({ data: settings });
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	// Only admins should be able to update instance settings
	// For now, let's just check if user is logged in
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const settings = await updateInstanceSettings(body);

	return json({ data: settings });
};
