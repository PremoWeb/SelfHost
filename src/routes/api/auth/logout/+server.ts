import { json } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/auth/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (locals.sessionId) {
		await deleteSession(locals.sessionId);
	}

	// Clear session cookie
	cookies.delete('session', { path: '/' });

	return json({ message: 'Logged out successfully' });
};
