import { json } from '@sveltejs/kit';
import { updatePrivateKey, deletePrivateKey } from '$lib/server/services/security';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const isGodUser = await isGod(locals.user.id);
	if (!locals.team && !isGodUser) {
		return json({ message: 'Team required' }, { status: 400 });
	}

	const body = await request.json();
	const key = await updatePrivateKey(params.uuid, locals.team?.id || null, isGodUser, body);

	if (!key) {
		return json({ message: 'Private key not found or update failed' }, { status: 404 });
	}

	return json({ data: key });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const isGodUser = await isGod(locals.user.id);
	if (!locals.team && !isGodUser) {
		return json({ message: 'Team required' }, { status: 400 });
	}

	const key = await deletePrivateKey(params.uuid, locals.team?.id || null, isGodUser);

	if (!key) {
		return json({ message: 'Private key not found or deletion failed' }, { status: 404 });
	}

	return json({ message: 'Private key deleted successfully' });
};
