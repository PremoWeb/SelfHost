import { getS3StoragesByTeam } from '$lib/server/services/storages';
import { requireAuth, requireTeam } from '$lib/server/auth/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);

	if (!locals.team) {
		return {
			storages: []
		};
	}

	const storages = await getS3StoragesByTeam(locals.team.id);

	return {
		storages
	};
};
