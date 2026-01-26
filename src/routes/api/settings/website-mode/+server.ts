import { json } from '@sveltejs/kit';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import { getInstanceSettings, updateInstanceSettings } from '$lib/server/services/settings';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	await requireApiAuth(locals);
	
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const userIsGod = locals.user?.id ? await isGod(locals.user.id) : false;
	if (!userIsGod) {
		return json({ message: 'Only god users can view website mode settings' }, { status: 403 });
	}

	const settings = await getInstanceSettings();
	return json({ data: { websiteMode: settings?.websiteMode || false } });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);
	
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const userIsGod = locals.user?.id ? await isGod(locals.user.id) : false;
	if (!userIsGod) {
		return json({ message: 'Only god users can toggle website mode' }, { status: 403 });
	}

	const { enabled } = await request.json();
	
	if (typeof enabled !== 'boolean') {
		return json({ message: 'enabled must be a boolean' }, { status: 400 });
	}

	try {
		await updateInstanceSettings({ websiteMode: enabled });
		return json({ data: { success: true, websiteMode: enabled } });
	} catch (error: any) {
		return json({ message: error.message || 'Failed to update website mode' }, { status: 500 });
	}
};
