/**
 * Client load for (app)/servers/[id] — fetches server from Zig API.
 */
import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import { serversApi } from '$lib/api/resources/servers';
import { isUnimplementedRoute } from '$lib/api/client';
import type { Server } from '$lib/types';
import type { PageLoad } from './$types';

function isNotFoundError(e: unknown): boolean {
	const status = (e as { response?: { status?: number } })?.response?.status;
	return status === 404;
}

function parseTags(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter((x): x is string => typeof x === 'string');
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value) as unknown;
			return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
		} catch {
			return [];
		}
	}
	return [];
}

function normalizeServer(raw: Record<string, unknown>): Server {
	const id = String(raw.id ?? raw.uuid ?? '');
	return {
		id,
		uuid: id,
		name: String(raw.name ?? ''),
		description: raw.description != null ? String(raw.description) : null,
		ip: String(raw.ip ?? ''),
		ipv6: raw.ipv6 != null ? String(raw.ipv6) : null,
		port: Number(raw.port) || 22,
		user: String(raw.user ?? 'root'),
		status: (raw.status as Server['status']) ?? 'offline',
		team_id: String(raw.team_id ?? ''),
		tags: parseTags(raw.tags),
		privateKeyId: raw.private_key_id != null ? String(raw.private_key_id) : null,
		connectionType: raw.connection_type != null ? String(raw.connection_type) : 'ssh',
		healthCpu: typeof raw.health_cpu === 'number' ? raw.health_cpu : Number(raw.health_cpu) || 0,
		healthMemory: typeof raw.health_memory === 'number' ? raw.health_memory : Number(raw.health_memory) || 0,
		healthDisk: typeof raw.health_disk === 'number' ? raw.health_disk : Number(raw.health_disk) || 0,
		healthUpdatedAt: raw.health_updated_at ?? null,
		agentVersion: raw.agent_version != null ? String(raw.agent_version) : null,
		agentChecksum: raw.agent_checksum != null ? String(raw.agent_checksum) : null,
		agentInstalledAt: raw.agent_installed_at != null ? (typeof raw.agent_installed_at === 'number' ? raw.agent_installed_at * 1000 : String(raw.agent_installed_at)) : null,
		proxyType: raw.proxy_type != null ? String(raw.proxy_type) : 'none',
		proxyStatus: raw.proxy_status != null ? String(raw.proxy_status) : 'stopped',
		created_at: String(raw.created_at ?? ''),
		updated_at: String(raw.updated_at ?? '')
	};
}

const empty = {
	server: null as Server | null,
	vpsProviders: [] as any[],
	privateKeys: [] as any[],
	availableDomains: [] as any[],
	quickDeployApps: [] as any[],
	deployedApps: [] as any[]
};

export const load: PageLoad = async ({ params }) => {
	const id = params.id;
	if (!id) return empty;
	try {
		const res = await serversApi.getById(id);
		const body = (res as { data?: { data?: unknown } }).data;
		const raw = body?.data;
		if (!raw || typeof raw !== 'object') return empty;
		const server = normalizeServer(raw as Record<string, unknown>);
		let tunnelUrl: string | null = null;
		try {
			const tunnelRes = await api.get<{ url: string | null }>('/dev/tunnel');
			if (tunnelRes.data?.url && typeof tunnelRes.data.url === 'string') {
				tunnelUrl = tunnelRes.data.url;
			}
		} catch {
			// Dev tunnel optional (403 when SELFHOST_DEV not set)
		}
		return {
			server,
			vpsProviders: [],
			privateKeys: [],
			availableDomains: [],
			quickDeployApps: [],
			deployedApps: [],
			localAgentChecksum: null,
			localAgentVersion: null,
			tunnelUrl
		};
	} catch (e) {
		if (isNotFoundError(e)) throw redirect(302, '/servers');
		if (isUnimplementedRoute(e)) return empty;
		throw e;
	}
};
