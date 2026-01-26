import { json } from '@sveltejs/kit';
import { register as registerUser } from '$lib/server/auth/session';
import type { RequestHandler } from './$types';

import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { name, email, password } = await request.json();

	if (!name || !email || !password) {
		return json({ message: 'Name, email, and password are required' }, { status: 400 });
	}

	const result = await registerUser(name, email, password);

	if (!result.success) {
		return json({ message: result.error }, { status: 400 });
	}

	// Set session cookie
	cookies.set('session', result.session.sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: !dev ? 'strict' : 'lax',
		secure: !dev,
		maxAge: 60 * 60 * 24 * 7 // 7 days
	});

	return json({
		data: {
			user: {
				id: result.user.id,
				name: result.user.name,
				email: result.user.email,
				createdAt: result.user.createdAt
			},
			team: result.team
		}
	});
};
