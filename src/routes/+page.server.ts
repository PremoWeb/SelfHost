import { redirect } from '@sveltejs/kit';
import { getInstanceSettings } from '$lib/server/services/settings';
import { isGod } from '$lib/server/auth/permissions';
import { getServersByTeam } from '$lib/server/services/servers';
import { getProjectsByTeam } from '$lib/server/services/projects';
import { getDeploymentsByTeam } from '$lib/server/services/deployments';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Get layout data to check authentication
	const layoutData = await parent();
	
	// Check website mode
	const instanceSettings = await getInstanceSettings();
	const websiteMode = !!instanceSettings?.websiteMode;
	
	// If not authenticated and website mode is on, show landing page
	if (!locals.user && websiteMode) {
		return {
			shouldShowLanding: true,
			websiteMode: true
		};
	}
	
	// If not authenticated and website mode is off, redirect to login
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	
	// Authenticated users - load dashboard data
	const teamId = locals.team?.id;
	const isGodUser = await isGod(locals.user.id);
	
	// For God users without team context, show all data
	// For God users with team context, show that team's data
	// For regular users, show their team's data
	if (!teamId) {
		if (isGodUser) {
			// God mode - show all servers, projects, deployments
			const [servers, projects, deployments] = await Promise.all([
				getServersByTeam(null),
				getProjectsByTeam(null),
				getDeploymentsByTeam(null, isGodUser)
			]);
			
			return {
				shouldShowLanding: false,
				stats: {
					projects: projects.length,
					servers: servers.length,
					deployments: deployments.length,
					keys: 0, // TODO: Get keys count
					sources: 0 // TODO: Get sources count
				},
				servers: servers
			};
		} else {
			// Regular user without team - show empty dashboard
			return {
				shouldShowLanding: false,
				stats: { projects: 0, servers: 0, deployments: 0, keys: 0, sources: 0 },
				servers: []
			};
		}
	}
	
	// User has a team - load team-specific data
	const [servers, projects, deployments] = await Promise.all([
		getServersByTeam(teamId),
		getProjectsByTeam(teamId),
		getDeploymentsByTeam(teamId, isGodUser)
	]);
	
	return {
		shouldShowLanding: false,
		stats: {
			projects: projects.length,
			servers: servers.length,
			deployments: deployments.length,
			keys: 0, // TODO: Get keys count
			sources: 0 // TODO: Get sources count
		},
		servers: servers
	};
};
