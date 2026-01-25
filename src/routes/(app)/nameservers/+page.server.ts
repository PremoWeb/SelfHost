import { error, redirect, fail } from '@sveltejs/kit';
import { getNameserverProfilesByTeam, createNameserverProfile, deleteNameserverProfile, setDefaultNameserverProfile, shareNameserverProfile } from '$lib/server/services/nameserverProfiles';
import { getVpsProvidersByTeam } from '$lib/server/services/vps/providers';
import type { PageServerLoad } from './$types';

import { requireAuth, isGod } from '$lib/server/auth/permissions';

export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);
	
	// God users can access this page but won't have a team
	// Regular users need a team
	if (!locals.team && !(await isGod(locals.user!.id))) {
		throw error(400, 'Team required');
	}

	const [profiles, vpsProviders] = await Promise.all([
		getNameserverProfilesByTeam(locals.team?.id),
		getVpsProvidersByTeam(locals.team?.id)
	]);

	return {
		profiles,
		vpsProviders,
		defaultProfileId: locals.team?.defaultNameserverProfileId || null
	};
};

export const actions = {
	create: async ({ request, locals }) => {
		await requireAuth(locals);
		if (!locals.team && !(await isGod(locals.user!.id))) {
			return fail(400, { message: 'Team required' });
		}
		if (!locals.team) {
			return fail(400, { message: 'Team required for this operation' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const ns1 = formData.get('ns1') as string;
		const ns2 = formData.get('ns2') as string;
		const ns3 = formData.get('ns3') as string;
		const ns4 = formData.get('ns4') as string;
		const dnsProviderId = formData.get('dnsProviderId') as string;

		if (!name || !ns1) {
			return { success: false, error: 'Name and NS1 are required' };
		}

		await createNameserverProfile({
			name,
			ns1,
			ns2: ns2 || null,
			ns3: ns3 || null,
			ns4: ns4 || null,
			dnsProviderId: dnsProviderId || null,
			teamId: locals.team.id
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

		if (!id) return { success: false, error: 'Missing ID' };

		await deleteNameserverProfile(id, locals.team.id);

		return { success: true };
	},

	setDefault: async ({ request, locals }) => {
		await requireAuth(locals);
		if (!locals.team) {
			return fail(400, { message: 'Team required for this operation' });
		}

		const formData = await request.formData();
		const profileId = formData.get('profileId') as string;

		await setDefaultNameserverProfile(locals.team.id, profileId || null);

		return { success: true };
	},

    share: async ({ request, locals }) => {
        await requireAuth(locals);
        if (!locals.team) {
            return fail(400, { message: 'Team required for this operation' });
        }

        const formData = await request.formData();
        const profileId = formData.get('profileId') as string;
        const assigneeType = formData.get('assigneeType') as 'user' | 'team' | 'company';
        const assigneeId = formData.get('assigneeId') as string;
        const role = formData.get('role') as 'use' | 'manage';

        if (!profileId || !assigneeType || !assigneeId) {
            return fail(400, { message: 'Missing required fields' });
        }
        
        // In a real implementation, you might want to verify the assigneeId exists (look up user/team/company)
        // For now we assume valid input or that FK constraints will fail if invalid (though assigneeId isn't FKed to multiple tables directly in the naive schema)

        await shareNameserverProfile(profileId, assigneeType, assigneeId, role);

        return { success: true };
    }
};
