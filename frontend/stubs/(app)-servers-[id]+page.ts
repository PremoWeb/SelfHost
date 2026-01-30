/**
 * Client load for (app)/servers/[id] — fetches server by id from Zig API.
 */
import { api } from '$lib/api/client';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	try {
		const res = await api.get<{ data?: any }>(`/servers/${params.id}`);
		const server = (res.data as any)?.data ?? res.data;
		if (!server) {
			return { server: null, vpsProviders: [], privateKeys: [], availableDomains: [], quickDeployApps: [] };
		}
		return {
			server,
			vpsProviders: [],
			privateKeys: [],
			availableDomains: [],
			quickDeployApps: []
		};
	} catch {
		return { server: null, vpsProviders: [], privateKeys: [], availableDomains: [], quickDeployApps: [] };
	}
};
