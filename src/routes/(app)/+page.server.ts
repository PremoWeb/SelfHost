import { getServersByTeam } from '$lib/server/services/servers';
import { db } from '$lib/server/db/client';
import { deployments, projects, servers, applications, destinations, privateKeys, sources } from '$lib/server/db/schema';
import { count, eq, or, isNull } from 'drizzle-orm';
import { isGod } from '$lib/server/auth/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Get layout data for context information
	const layoutData = await parent();
	
	const teamId = locals.team?.id;
	const isGodUser = locals.user ? await isGod(locals.user.id) : false;

	// For God users without team context, show all data
	// For God users with team context, show that team's data
	// For regular users, show their team's data
	if (!teamId) {
		if (isGodUser) {
			// God mode: show all projects, servers, and deployments
			const [projectsCount] = await db.select({ value: count() }).from(projects);
			const [serversCount] = await db.select({ value: count() }).from(servers);
			const [deploymentsCount] = await db.select({ value: count() }).from(deployments);
			const [keysCount] = await db.select({ value: count() }).from(privateKeys);
			const [sourcesCount] = await db.select({ value: count() }).from(sources);
			
			// Get all servers for God users
			const allServers = await db
				.select()
				.from(servers)
				.orderBy(servers.createdAt);

			return {
				stats: {
					projects: projectsCount.value,
					servers: serversCount.value,
					deployments: deploymentsCount.value,
					keys: keysCount.value,
					sources: sourcesCount.value
				},
				servers: allServers.map(s => ({ ...s, application_count: 0, database_count: 0 })),
				// Include context info from layout
				user: layoutData.user,
				team: layoutData.team,
				activeCompany: layoutData.activeCompany,
				isImpersonating: layoutData.isImpersonating,
				impersonationType: layoutData.impersonationType,
				isGod: layoutData.isGod
			};
		} else {
			// Non-God users need a team
			return {
				stats: { projects: 0, servers: 0, deployments: 0, keys: 0, sources: 0 },
				servers: [],
				// Include context info from layout
				user: layoutData.user,
				team: layoutData.team,
				activeCompany: layoutData.activeCompany,
				isImpersonating: layoutData.isImpersonating,
				impersonationType: layoutData.impersonationType,
				isGod: layoutData.isGod
			};
		}
	}

	// Fetch counts for team context
	const [projectsCount] = await db.select({ value: count() }).from(projects).where(eq(projects.teamId, teamId));
	const [serversCount] = await db.select({ value: count() }).from(servers).where(eq(servers.teamId, teamId));
	const [keysCount] = await db.select({ value: count() }).from(privateKeys).where(eq(privateKeys.teamId, teamId));
	const [sourcesCount] = await db.select({ value: count() }).from(sources).where(eq(sources.teamId, teamId));
	
	// Count deployments for this team's applications
	// Applications link to servers through destinations
	// Get all applications for this team's servers, then count their deployments
	const { inArray } = await import('drizzle-orm');
	const teamApplicationIds = await db
		.select({ id: applications.id })
		.from(applications)
		.innerJoin(destinations, eq(applications.destinationId, destinations.id))
		.innerJoin(servers, eq(destinations.serverId, servers.id))
		.where(eq(servers.teamId, teamId));
	
	const applicationIdList = teamApplicationIds.map(a => a.id);
	const deploymentsCount = applicationIdList.length > 0
		? await db.select({ value: count() }).from(deployments).where(
			inArray(deployments.applicationId, applicationIdList)
		)
		: [{ value: 0 }];

	const teamServers = await getServersByTeam(teamId);

	return {
		stats: {
			projects: projectsCount.value,
			servers: serversCount.value,
			deployments: deploymentsCount[0]?.value || 0,
			keys: keysCount.value,
			sources: sourcesCount.value
		},
		servers: teamServers,
		// Include context info from layout
		user: layoutData.user,
		team: layoutData.team,
		activeCompany: layoutData.activeCompany,
		isImpersonating: layoutData.isImpersonating,
		impersonationType: layoutData.impersonationType,
		isGod: layoutData.isGod
	};
};
