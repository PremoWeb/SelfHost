import { error, redirect, fail } from '@sveltejs/kit';
import { getVpsProvidersByTeam, createVpsProvider, deleteVpsProvider, updateVpsProvider } from '$lib/server/services/vps/providers';
import { getCloudflareAccessTokensByTeam, createCloudflareAccessToken, deleteCloudflareAccessToken } from '$lib/server/services/cloudflare-tokens';
import { VultrService } from '$lib/server/services/vps/vultr';
import { requireAuth, isGod } from '$lib/server/auth/permissions';
import { getDefaultCompanyForResource } from '$lib/server/services/companies';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);
	
	// God users can access this page but won't have a team
	// Regular users need a team
	if (!locals.team && !(await isGod(locals.user!.id))) {
		throw error(400, 'Team required');
	}

	const providers = await getVpsProvidersByTeam(locals.team?.id);
	const cfTokens = await getCloudflareAccessTokensByTeam(locals.team?.id);

	return {
		providers,
		cfTokens
	};
};

export const actions = {
	create: async ({ request, locals }) => {
		await requireAuth(locals);
		if (!locals.team && !(await isGod(locals.user!.id))) {
			return fail(400, { message: 'Team required for this operation' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const type = formData.get('type') as string;
		const apiKey = formData.get('apiKey') as string;
		const companyId = formData.get('companyId') as string | null;

		if (!name || !type || !apiKey) {
			return { success: false, error: 'Missing required fields' };
		}

		// Determine company assignment: use provided companyId, or default company, or null (god user)
		let assignedCompanyId: string | null = companyId || null;
		if (!assignedCompanyId) {
			assignedCompanyId = await getDefaultCompanyForResource();
		}

		if (type === 'cloudflare_access') {
			const clientId = formData.get('clientId') as string;
			const clientSecret = formData.get('clientSecret') as string;

			if (!clientId || !clientSecret) {
				return fail(400, { message: 'Client ID and Secret are required for Cloudflare Access' });
			}

			await createCloudflareAccessToken({
				name,
				clientId,
				clientSecret,
				teamId: locals.team?.id || null,
				ownerType: locals.team ? 'team' : 'user',
				ownerId: locals.team ? locals.team.id : locals.user!.id
			});
		} else {
			// Validate API Key
			if (type === 'vultr') {
				try {
					const vultr = new VultrService(apiKey);
					await vultr.accountInfo();
				} catch (err) {
					return fail(400, { message: 'Invalid API Key. Please check credentials.' });
				}
			}

			await createVpsProvider({
				name,
				type,
				apiKey,
				teamId: locals.team?.id || null,
				companyId: assignedCompanyId
			});
		}

		return { success: true };
	},

    update: async ({ request, locals }) => {
		await requireAuth(locals);
		if (!locals.team && !(await isGod(locals.user!.id))) {
			return fail(400, { message: 'Team required for this operation' });
		}

		const formData = await request.formData();
        const id = formData.get('id') as string;
		const name = formData.get('name') as string;
		const apiKey = formData.get('apiKey') as string;

		if (!id || !name) {
			return { success: false, error: 'Missing required fields' };
		}

        const data: any = { name };
        if (apiKey) data.apiKey = apiKey;

		await updateVpsProvider(id, locals.team?.id, data);

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		await requireAuth(locals);
		if (!locals.team && !(await isGod(locals.user!.id))) {
			return fail(400, { message: 'Team required for this operation' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const type = formData.get('type') as string;

		if (!id) return { success: false, error: 'Missing ID' };

		if (type === 'cloudflare_access') {
			await deleteCloudflareAccessToken(id, locals.team?.id);
		} else {
			await deleteVpsProvider(id, locals.team?.id);
		}

		return { success: true };
	}
};
