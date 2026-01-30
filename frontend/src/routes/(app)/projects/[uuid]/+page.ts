/**
 * Client load for (app)/projects/[uuid] — fetches project from Zig API.
 */
import { projectsApi } from '$lib/api/resources/projects';
import type { PageLoad } from './$types';

type ProjectDetail = {
	id: string;
	name: string;
	description: string | null;
	clientId: string;
	client?: { id: string; name: string } | null;
	isShared: boolean;
	environments: { id: string; name: string; description?: string | null }[];
	createdAt: string;
	updatedAt: string;
};

function normalizeProject(raw: Record<string, unknown>): ProjectDetail {
	const created_at = raw.created_at;
	const updated_at = raw.updated_at;
	const createdAt =
		typeof created_at === 'number'
			? new Date(created_at * 1000).toISOString()
			: String(created_at ?? '');
	const updatedAt =
		typeof updated_at === 'number'
			? new Date(updated_at * 1000).toISOString()
			: String(updated_at ?? '');
	return {
		id: String(raw.id ?? ''),
		name: String(raw.name ?? ''),
		description: raw.description != null ? String(raw.description) : null,
		clientId: String(raw.client_id ?? ''),
		client: null,
		isShared: false,
		environments: [],
		createdAt,
		updatedAt
	};
}

export const load: PageLoad = async ({ params }) => {
	const uuid = params.uuid;
	if (!uuid) {
		throw new Error('Missing project UUID');
	}
	try {
		const res = await projectsApi.getById(uuid);
		const body = (res as { data?: { data?: unknown } }).data;
		const raw = body?.data;
		if (!raw || typeof raw !== 'object') {
			throw new Error('Project not found');
		}
		const project = normalizeProject(raw as Record<string, unknown>);
		return {
			project,
			clients: [] as { id: string; name: string; company?: string }[],
			sharedTeams: [] as { team: { id: string; name: string }; role: string }[]
		};
	} catch (err: unknown) {
		const status = (err as { response?: { status?: number } })?.response?.status;
		if (status === 404) {
			throw new Error('Project not found');
		}
		throw err;
	}
};
