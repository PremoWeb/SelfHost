import { json } from '@sveltejs/kit';
import { updateUserProfile } from '$lib/server/services/users';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const user = await updateUserProfile(locals.user.id, body);

	if (!user) {
		return json({ message: 'User not found or update failed' }, { status: 404 });
	}

	return json({ data: user });
};
