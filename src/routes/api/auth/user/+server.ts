import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	return json({
		data: {
			user: {
				id: locals.user.id,
				name: locals.user.name,
				email: locals.user.email,
				emailVerifiedAt: locals.user.emailVerifiedAt,
				createdAt: locals.user.createdAt
			},
			team: locals.team
		}
	});
};
