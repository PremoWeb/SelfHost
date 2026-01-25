import { error } from '@sveltejs/kit';
import { getPrivateKeyById } from '$lib/server/services/security';
import { requireAuth, isGod } from '$lib/server/auth/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	await requireAuth(locals);

	// God users can access without a team
	if (!locals.team && !(await isGod(locals.user!.id))) {
		throw error(400, 'Team required');
	}

	const key = await getPrivateKeyById(params.uuid, locals.team?.id || null, await isGod(locals.user!.id));

	if (!key) {
		throw error(404, 'Private key not found');
	}

	return {
		privateKey: key
	};
};
import { updatePrivateKey, deletePrivateKey } from '$lib/server/services/security';

export const actions = {
    update: async ({ request, params, locals }) => {
        await requireAuth(locals);
        
        const isGodUser = await isGod(locals.user!.id);
        if (!locals.team && !isGodUser) {
            return { success: false, message: 'Team required for this operation' };
        }

        const formData = await request.formData();
        const name = formData.get('name') as string;
        const description = formData.get('description') as string;
        const privateKey = formData.get('privateKey') as string;

        if (!name || !privateKey) {
            return { success: false, message: 'Name and Private Key are required' };
        }

        try {
            const key = await updatePrivateKey(params.uuid, locals.team?.id || null, isGodUser, {
                name,
                description,
                privateKey
            });
            return { success: true, key };
        } catch (e) {
            return { success: false, message: 'Failed to update key' };
        }
    },
    delete: async ({ params, locals }) => {
        await requireAuth(locals);
        
        const isGodUser = await isGod(locals.user!.id);
        if (!locals.team && !isGodUser) {
            return { success: false, message: 'Team required for this operation' };
        }

        try {
            await deletePrivateKey(params.uuid, locals.team?.id || null, isGodUser);
            return { success: true };
        } catch (e) {
            return { success: false, message: 'Failed to delete key' };
        }
    }
};
