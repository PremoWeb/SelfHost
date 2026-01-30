/**
 * Client load for (app)/projects — fetches projects from Zig API.
 */
import { projectsApi } from '$lib/api/resources/projects';
import type { Project } from '$lib/types';
import type { PageLoad } from './$types';

function normalizeProject(raw: Record<string, unknown>): Project {
	const created_at = raw.created_at;
	const createdAt =
		typeof created_at === 'number'
			? new Date(created_at * 1000).toISOString()
			: typeof created_at === 'string'
				? created_at
				: undefined;
	return {
		id: String(raw.id ?? ''),
		uuid: String(raw.id ?? raw.uuid ?? ''),
		name: String(raw.name ?? ''),
		description: raw.description != null ? String(raw.description) : null,
		team_id: String(raw.team_id ?? ''),
		created_at: typeof created_at === 'number' ? String(created_at) : String(created_at ?? ''),
		updated_at: String(raw.updated_at ?? ''),
		createdAt,
		client: null
	};
}

export const load: PageLoad = async () => {
	try {
		const res = await projectsApi.getAll();
		const data = (res as { data?: { data?: unknown[] } }).data?.data;
		const rawList = Array.isArray(data) ? data : [];
		const projects = rawList.map((p) => normalizeProject(p as Record<string, unknown>));
		return { projects, clients: [] };
	} catch {
		return { projects: [], clients: [] };
	}
};
