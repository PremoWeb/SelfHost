/**
 * Client load for (app)/servers — fetches servers from Zig API.
 */
import { api } from '$lib/api/client';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	try {
		const res = await api.get<{ data?: any[] }>('/servers');
		const data = (res.data as any)?.data;
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
