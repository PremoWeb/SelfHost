/**
 * Client load for (app)/servers — fetches servers from Zig API.
 * God users get all servers; others get servers for their active team.
 * Awaits parent so layout session/cookie is ready before calling API.
 */
import { api } from '$lib/api/client';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	// Ensure layout has run (session loaded, cookie available) before we call /api/servers
	await parent();

	try {
		const res = await api.get<{ data?: any[] }>('/servers');
		const body = res.data as { data?: any[] } | any[] | undefined;
		// Zig returns { data: [...] }; support direct array as fallback
		const data = Array.isArray(body) ? body : body?.data;
		const servers = Array.isArray(data) ? data : [];
		return {
			servers,
			vpsProviders: [],
			privateKeys: [],
			accessTokens: [],
			discoveredInstances: [],
			localAgentChecksum: null
		};
	} catch {
		return {
			servers: [],
			vpsProviders: [],
			privateKeys: [],
			accessTokens: [],
			discoveredInstances: [],
			localAgentChecksum: null
		};
	}
};
