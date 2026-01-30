/**
 * Client load for (app)/projects — fetches projects from Zig API.
 */
import { api } from '$lib/api/client';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	try {
		const res = await api.get<{ data?: any[] }>('/projects');
		const data = (res.data as any)?.data;
		const projects = Array.isArray(data) ? data : [];
		return { projects, clients: [] };
	} catch {
		return { projects: [], clients: [] };
	}
};
