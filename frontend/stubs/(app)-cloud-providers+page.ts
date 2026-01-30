import type { PageLoad } from './$types';
import { api } from '$lib/api/client';

export const load: PageLoad = async () => {
	try {
		const [providersRes, tokensRes] = await Promise.all([
			api.get<{ data?: any[] }>('/vps-providers').catch(() => ({ data: [] })),
			api.get<{ data?: any[] }>('/cloudflare-tokens').catch(() => ({ data: [] }))
		]);
		
		const providers = (providersRes.data as any)?.data || [];
		const cfTokens = (tokensRes.data as any)?.data || [];
		
		return {
			providers,
			cfTokens
		};
	} catch {
		return {
			providers: [],
			cfTokens: []
		};
	}
};
