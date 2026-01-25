import { getDestinationById } from '$lib/server/services/destinations';
import { getServersByTeam } from '$lib/server/services/servers';
import { requireAuth } from '$lib/server/auth/permissions';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { updateDestination, deleteDestination } from '$lib/server/services/destinations';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requireAuth(locals);

	if (!locals.team) {
		throw redirect(302, '/destinations');
	}

	const [destination, servers] = await Promise.all([
		getDestinationById(params.id, locals.team.id),
		getServersByTeam(locals.team.id)
	]);

	if (!destination) {
		throw error(404, 'Destination not found');
	}

	return {
		destination,
		servers
	};
};

export const actions: Actions = {
	update: async ({ locals, params, request }) => {
		await requireAuth(locals);
		if (!locals.team) throw error(401);

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const network = formData.get('network') as string;
		const type = formData.get('type') as string;
		const serverId = formData.get('serverId') as string;

		await updateDestination(params.id, locals.team.id, {
			name,
			description,
			network,
			type,
			serverId
		});

		return { success: true };
	},

	delete: async ({ locals, params }) => {
		await requireAuth(locals);
		if (!locals.team) throw error(401);

		await deleteDestination(params.id, locals.team.id);
		throw redirect(302, '/destinations');
	}
};
