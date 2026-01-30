import type { PageLoad } from './$types';
import { api } from '$lib/api/client';

function normalizeProvider(p: any) {
	return {
		...p,
		createdAt: p.created_at ?? p.createdAt,
		dnsEnabled: p.dns_enabled ?? p.dnsEnabled
	};
}

function normalizeCfToken(t: any) {
	return {
		...t,
		createdAt: t.created_at ?? t.createdAt
	};
}

export const load: PageLoad = async () => {
	try {
		const [providersRes, tokensRes] = await Promise.all([
			api.get<{ data?: any[] }>('/vps-providers').catch(() => ({ data: [] })),
			api.get<{ data?: any[] }>('/cloudflare-tokens').catch(() => ({ data: [] }))
		]);
		const rawProviders = (providersRes.data as any)?.data || [];
		const rawTokens = (tokensRes.data as any)?.data || [];
		const providers = rawProviders.map(normalizeProvider);
		const cfTokens = rawTokens.map(normalizeCfToken);
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
