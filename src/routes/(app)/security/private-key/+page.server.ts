import { error } from '@sveltejs/kit';
import { getPrivateKeysByTeam } from '$lib/server/services/security';
import { requireAuth, isGod } from '$lib/server/auth/permissions';
import type { PageServerLoad } from './$types';



export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);
	
	// God users can access this page without a team
	if (!locals.team && !(await isGod(locals.user!.id))) {
		throw error(400, 'Team required');
	}

	const privateKeys = locals.team ? await getPrivateKeysByTeam(locals.team.id) : [];

	return {
		privateKeys
	};
};

import { generateKeyPair, createPrivateKey } from '$lib/server/services/security';

export const actions = {
    generate: async () => {
        try {
            const { privateKey, publicKey } = generateKeyPair();
            return { success: true, privateKey, publicKey };
        } catch (e) {
            throw error(500, 'Generation failed');
        }
    },
    create: async ({ request, locals }) => {
        await requireAuth(locals);
        if (!locals.team && !(await isGod(locals.user!.id))) {
            return { success: false, message: 'Team required for this operation' };
        }
        const formData = await request.formData();
        const name = formData.get('name') as string;
        const description = formData.get('description') as string;
        const privateKey = formData.get('privateKey') as string;

        if (!name || !privateKey) {
            return { success: false, message: 'Name and Private Key are required' };
        }

        // Determine company assignment: use provided companyId, or default company, or null (god user)
        const companyId = formData.get('companyId') as string | null;
        let assignedCompanyId: string | null = companyId || null;
        if (!assignedCompanyId) {
            const { getDefaultCompanyForResource } = await import('$lib/server/services/companies');
            assignedCompanyId = await getDefaultCompanyForResource();
        }

        try {
            const key = await createPrivateKey({
                name,
                description,
                privateKey,
                teamId: locals.team?.id || null,
                companyId: assignedCompanyId
            });
            return { success: true, key };
        } catch (e) {
            return { success: false, message: 'Failed to create key' };
        }
    }
};
