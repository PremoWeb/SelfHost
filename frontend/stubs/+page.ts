/**
 * Client-side load for root page — fetches servers and projects from Zig API when server load is stubbed.
 */
import { api } from '$lib/api/client';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	try {
		const [serversRes, projectsRes] = await Promise.all([
			api.get<{ data?: any[] }>('/servers').catch(() => ({ data: [] })),
			api.get<{ data?: any[] }>('/projects').catch(() => ({ data: [] }))
		]);
		const servers = Array.isArray(serversRes.data) ? serversRes.data : (serversRes.data as any)?.data ?? [];
		const projects = Array.isArray(projectsRes.data) ? projectsRes.data : (projectsRes.data as any)?.data ?? [];
		return {
			shouldShowLanding: false,
			shouldUseAppLayout: true,
			user: null,
			team: null,
			websiteMode: false,
			servers,
			stats: {
				servers: servers.length,
				projects: projects.length,
				deployments: 0,
				keys: 0,
				sources: 0
			}
		};
	} catch {
		return {
			shouldShowLanding: false,
			shouldUseAppLayout: true,
			user: null,
			team: null,
			websiteMode: false,
			servers: [],
			stats: { servers: 0, projects: 0, deployments: 0, keys: 0, sources: 0 }
		};
	}
};
