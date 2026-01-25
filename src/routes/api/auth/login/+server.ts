import { json } from '@sveltejs/kit';
import { login as loginUser } from '$lib/server/auth/session';
import type { RequestHandler } from './$types';

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
		sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
		secure: process.env.NODE_ENV === 'production',
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
