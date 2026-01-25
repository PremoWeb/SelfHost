import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { clientsService } from '$lib/server/services/clients';
import { requireAuth, isGod } from '$lib/server/auth/permissions';

export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);
	
	// God users can access this page but won't have a team
	// Regular users need a team
	if (!locals.team && !(await isGod(locals.user!.id))) {
		throw error(400, 'Team required');
	}

	const clients = locals.team ? await clientsService.getClientsByTeam(locals.team.id) : [];

	return {
		clients
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		await requireAuth(locals);
		if (!locals.team) {
			return fail(400, { message: 'Team required for this operation' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const company = formData.get('company') as string;

		if (!name) {
			return fail(400, { message: 'Name is required' });
		}

		await clientsService.createClient({
			name,
			email,
			phone,
			company,
			teamId: locals.team.id
		});

		return { success: true };
	},

	update: async ({ request, locals }) => {
		await requireAuth(locals);
		if (!locals.team) {
			return fail(400, { message: 'Team required for this operation' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const company = formData.get('company') as string;

		if (!id || !name) {
			return fail(400, { message: 'ID and Name are required' });
		}

		await clientsService.updateClient(id, locals.team.id, {
			name,
			email,
			phone,
			company
		});

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		await requireAuth(locals);
		if (!locals.team) {
			return fail(400, { message: 'Team required for this operation' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'ID is required' });
		}

		await clientsService.deleteClient(id, locals.team.id);

		return { success: true };
	}
};
