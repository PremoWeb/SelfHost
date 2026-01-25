import { error } from '@sveltejs/kit';
import { getUserSshKeys } from '$lib/server/services/git';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Profile page should be accessible to all authenticated users
	// We only check if user exists, not if they're authorized (which requires team/super admin)
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const sshKeys = await getUserSshKeys(locals.user.id);

	return {
		user: locals.user,
		sshKeys
	};
};
