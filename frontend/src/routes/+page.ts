/**
 * Client-side load for root page — loads session (so / knows if logged in), then servers and projects.
 */
import { api } from '$lib/api/client';
import { authApi } from '$lib/api/resources/auth';
import { teamsApi } from '$lib/api/resources/teams';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	// Load session first so we know if user is logged in (avoids redirect-to-login when on /)
	const session = await authApi.getSession();
	const user = session?.user
		? {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
				emailVerifiedAt: null as Date | null,
				createdAt: new Date(),
				updatedAt: new Date()
			}
		: null;
	const team = session?.team ?? null;
	const teams = user ? await teamsApi.getTeams() : [];
	const teamsList = teams.length > 0 ? teams : team ? [team] : [];

	try {
		const [serversRes, projectsRes] = await Promise.all([
			api.get<{ data?: any[] }>('/servers').catch(() => ({ data: [] })),
			api.get<{ data?: any[] }>('/projects').catch(() => ({ data: [] }))
		]);
		const servers = Array.isArray(serversRes.data)
			? serversRes.data
			: ((serversRes.data as any)?.data ?? []);
		const projects = Array.isArray(projectsRes.data)
			? projectsRes.data
			: ((projectsRes.data as any)?.data ?? []);
		const websiteMode = true; // TODO: from API /settings/website-mode when available
		return {
			shouldShowLanding: websiteMode,
			shouldUseAppLayout: true,
			user,
			team,
			teams: teamsList,
			websiteMode,
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
		const websiteMode = false;
		return {
			shouldShowLanding: websiteMode,
			shouldUseAppLayout: true,
			user,
			team,
			teams: teamsList,
			websiteMode,
			servers: [],
			stats: { servers: 0, projects: 0, deployments: 0, keys: 0, sources: 0 }
		};
	}
};
