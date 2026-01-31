/**
 * Client load for cloud provider profile — fetches provider + related data from Zig API.
 * For Vultr providers, fetches instances, SSH keys, regions/plans/os and team private keys from Zig (which proxies Vultr API).
 */
import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import type { PageLoad } from './$types';

function normalizeProvider(p: Record<string, unknown>) {
	return {
		...p,
		id: String(p.id ?? ''),
		name: String(p.name ?? ''),
		type: String(p.type ?? p.type_name ?? ''),
		createdAt: p.created_at ?? p.createdAt,
		dnsEnabled: p.dns_enabled ?? p.dnsEnabled ?? false,
		server_count: Number(p.server_count) ?? 0,
		application_count: Number(p.application_count) ?? 0,
		database_count: Number(p.database_count) ?? 0,
		domain_count: Number(p.domain_count) ?? 0
	};
}

function mapVultrInstance(raw: Record<string, unknown>) {
	return {
		id: String(raw.id ?? ''),
		label: String(raw.label ?? raw.id ?? ''),
		main_ip: String(raw.main_ip ?? ''),
		vcpu_count: Number(raw.vcpu_count) ?? 0,
		ram: Number(raw.ram) ?? 0,
		region: String(raw.region ?? ''),
		status: String(raw.status ?? '')
	};
}

export const load: PageLoad = async ({ params }) => {
	const id = params.id;
	if (!id) {
		throw redirect(307, '/cloud-providers');
	}

	try {
		const [providerRes, serversRes, privateKeysRes] = await Promise.all([
			api.get<{ data?: Record<string, unknown> }>(`/vps-providers/${id}`),
			api.get<{ data?: unknown[] }>('/servers').catch(() => ({ data: [] })),
			api.get<{ data?: Array<{ id: string; name: string }> }>('/private-keys').catch(() => ({ data: [] }))
		]);

		const rawProvider = (providerRes.data as { data?: Record<string, unknown> })?.data;
		if (!rawProvider) {
			throw redirect(307, '/cloud-providers');
		}

		const provider = normalizeProvider(rawProvider);
		const servers = Array.isArray((serversRes.data as { data?: unknown[] })?.data)
			? ((serversRes.data as { data: unknown[] }).data as Record<string, unknown>[])
			: [];
		const teamPrivateKeys = Array.isArray((privateKeysRes.data as { data?: unknown[] })?.data)
			? ((privateKeysRes.data as { data: Array<{ id: string; name: string }> }).data)
			: [];

	// Start fetching Vultr data early but don't await yet
	const instancesPromise = provider.type === 'vultr' 
		? api.get<{ instances?: unknown[] }>(`/vps-providers/${id}/instances`)
			.then(r => {
				const raw = (r.data as { instances?: unknown[] })?.instances ?? [];
				return Array.isArray(raw) ? (raw as Record<string, unknown>[]).map(mapVultrInstance) : [];
			})
			.catch(() => [])
		: Promise.resolve([]);

	const providerSshKeysPromise = provider.type === 'vultr'
		? api.get<{ ssh_keys?: unknown[] }>(`/vps-providers/${id}/ssh-keys`)
			.then(r => {
				const raw = (r.data as { ssh_keys?: unknown[] })?.ssh_keys ?? [];
				return Array.isArray(raw) ? (raw as Record<string, unknown>[]).map(k => ({
					id: String(k.id ?? ''),
					name: String(k.name ?? k.id ?? '')
				})) : [];
			})
			.catch(() => [])
		: Promise.resolve([]);

	const metaPromise = provider.type === 'vultr'
		? Promise.all([
			api.get<{ regions?: unknown[] }>(`/vps-providers/${id}/regions`).catch(() => ({ regions: [] })),
			api.get<{ plans?: unknown[] }>(`/vps-providers/${id}/plans`).catch(() => ({ plans: [] })),
			api.get<{ os?: unknown[] }>(`/vps-providers/${id}/os`).catch(() => ({ os: [] }))
		]).then(([regionsRes, plansRes, osRes]) => {
			const rawRegions = (regionsRes.data as { regions?: unknown[] })?.regions ?? [];
			const regions = Array.isArray(rawRegions)
				? (rawRegions as Record<string, unknown>[]).map((r) => ({
						id: String(r.id ?? ''),
						city: String(r.city ?? r.id ?? '')
					}))
				: [];
			
			const rawPlans = (plansRes.data as { plans?: unknown[] })?.plans ?? [];
			const plans = Array.isArray(rawPlans)
				? (rawPlans as Record<string, unknown>[]).map((p) => ({
						id: String(p.id ?? ''),
						type: String(p.type ?? ''),
						ram: Number(p.ram) ?? 0,
						monthly_cost: Number(p.monthly_cost) ?? 0
					}))
				: [];
			
			const rawOs = (osRes.data as { os?: unknown[] })?.os ?? [];
			const os = Array.isArray(rawOs) && rawOs.length > 0
					? (rawOs as Record<string, unknown>[]).map((o) => ({
							id: String(o.id ?? ''),
							name: String(o.name ?? o.id ?? '')
						}))
					: [{ id: '387', name: 'Ubuntu 22.04 LTS' }];

			return { regions, plans, os };
		})
		: Promise.resolve({ regions: [], plans: [], os: [{ id: '387', name: 'Ubuntu 22.04 LTS' }] });

	return {
		provider,
		servers,
		teamPrivateKeys,
		templates: [], 
		streamed: {
			instances: instancesPromise,
			providerSshKeys: providerSshKeysPromise,
			meta: metaPromise
		}
	};
	} catch (e: unknown) {
		const status = (e as { response?: { status?: number } })?.response?.status;
		if (status === 404) {
			throw redirect(307, '/cloud-providers');
		}
		throw e;
	}
};
