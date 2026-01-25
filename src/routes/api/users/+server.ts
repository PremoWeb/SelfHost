import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import { createUser } from '$lib/server/services/users';

/**
 * POST /api/users
 * Create a new user (admin only)
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	// Only god users can create users
	if (!(await isGod(locals.user.id))) {
		return json({ message: 'Unauthorized' }, { status: 403 });
	}

	const { name, email, password, companyIds, teamIds } = await request.json();

	if (!name || !email || !password) {
		return json({ message: 'Name, email, and password are required' }, { status: 400 });
	}

	// Validate password
	if (password.length < 8) {
		return json({ message: 'Password must be at least 8 characters' }, { status: 400 });
	}

	try {
		const { user, team } = await createUser({
			name,
			email,
			password,
			companyIds: companyIds || [],
			teamIds: teamIds || []
		});
		return json(
			{
				data: {
					user: {
						id: user.id,
						name: user.name,
						email: user.email,
						emailVerified: user.emailVerified,
						createdAt: user.createdAt
					},
					team: {
						id: team.id,
						name: team.name
					}
				}
			},
			{ status: 201 }
		);
	} catch (error: any) {
		if (error.message === 'Email already in use') {
			return json({ message: error.message }, { status: 400 });
		}
		return json({ message: 'Failed to create user' }, { status: 500 });
	}
};
