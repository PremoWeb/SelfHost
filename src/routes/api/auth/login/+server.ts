import { json } from '@sveltejs/kit';
import { login as loginUser } from '$lib/server/auth/session';
import type { RequestHandler } from './$types';

import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { email, password } = await request.json();

	if (!email || !password) {
		return json({ message: 'Email and password are required' }, { status: 400 });
	}

	const result = await loginUser(email, password);

	if (!result.success) {
		return json({ message: result.error }, { status: 401 });
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
			}
		}
	});
};
