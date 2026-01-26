import { getServersByTeam, createServer } from '$lib/server/services/servers';
import { getVpsProvidersByTeam } from '$lib/server/services/vps/providers';
import { getPrivateKeysByTeam, getCloudflareAccessTokensByTeam } from '$lib/server/services/security';
import { getVultrInstances } from '$lib/server/services/vps/vultr';
import { getLocalAgentChecksum } from '$lib/server/services/agent';
import { fail } from '@sveltejs/kit';
import { requireAuth, isGod } from '$lib/server/auth/permissions';
import { getDefaultCompanyForResource } from '$lib/server/services/companies';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requireAuth(locals);
	
	// Return empty data if no team
	// Return empty data if no team, unless God
	const isGodUser = await isGod(locals.user!.id);
	if (!locals.team && !isGodUser) {
		return {
			servers: [],
			vpsProviders: [],
			privateKeys: [],
			discoveredInstances: [],
			localAgentChecksum: null
		};
	}
	
	const teamId = locals.team?.id;
	const servers = await getServersByTeam(teamId);
	const vpsProviders = await getVpsProvidersByTeam(teamId);
	const privateKeys = await getPrivateKeysByTeam(teamId);
	const localAgentChecksum = await getLocalAgentChecksum();

	// ... rest of the load function
	 // Fetch access tokens
	const accessTokens = await getCloudflareAccessTokensByTeam(teamId);

	// Fetch VPS instances from all connected providers
	let discoveredInstances: any[] = [];
	
	for (const provider of vpsProviders) {
		if (provider.type === 'vultr' && provider.apiKey) {
			try {
				const instances = await getVultrInstances(provider.apiKey);
				// Filter out instances that are already registered
				const unregisteredInstances = instances.filter(
					(instance: any) => !servers.some(s => s.ip === instance.main_ip)
				);
				discoveredInstances = [
					...discoveredInstances,
					...unregisteredInstances.map((instance: any) => ({
						...instance,
						providerId: provider.id,
						providerName: provider.name,
						providerType: provider.type
					}))
				];
			} catch (error) {
			}
		}
	}

	return {
		servers,
		vpsProviders,
		privateKeys,
		accessTokens,
		discoveredInstances,
		localAgentChecksum
	};
};

export const actions: Actions = {
	importInstance: async ({ request, locals }) => {
		await requireAuth(locals);
		if (!locals.team && !(await isGod(locals.user!.id))) {
			return fail(400, { message: 'Team required for this operation' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const ip = formData.get('ip') as string;
		const providerId = formData.get('providerId') as string;
		const companyId = formData.get('companyId') as string | null;

		// Determine company assignment: use provided companyId, or default company, or null (god user)
		let assignedCompanyId: string | null = companyId || null;
		if (!assignedCompanyId) {
			assignedCompanyId = await getDefaultCompanyForResource();
		}

		try {
			await createServer({
				name,
				ip,
				port: 22,
				user: 'root',
				teamId: locals.team?.id || null,
				vpsProviderId: providerId,
				status: 'offline',
				companyId: assignedCompanyId
			});

			return { success: true };
		} catch (error: any) {
			return fail(500, { message: error.message || 'Failed to import server' });
		}
	}
};
