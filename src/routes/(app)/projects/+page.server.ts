import { fail } from '@sveltejs/kit';
import { getProjectsByTeam, createProject } from '$lib/server/services/projects';
import { clientsService } from '$lib/server/services/clients';
import { requireAuth, isGod } from '$lib/server/auth/permissions';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    await requireAuth(locals);
    
    // Check if user is God
    const isGodUser = locals.user ? await isGod(locals.user.id) : false;
    
    // If no team context, handle differently for God users
    if (!locals.team) {
        if (isGodUser) {
            // God users: fetch ALL projects when in God mode
            // Mark projects as shared if they don't belong to the God user's teams
            const { db } = await import('$lib/server/db/client');
            const { projects, clients, teams, teamMembers } = await import('$lib/server/db/schema');
            const { eq, desc } = await import('drizzle-orm');
            
            // Get all teams the God user is a member of
            const godUserTeams = await db
                .select({ teamId: teamMembers.teamId })
                .from(teamMembers)
                .where(eq(teamMembers.userId, locals.user!.id));
            const godUserTeamIds = new Set(godUserTeams.map(t => t.teamId));
            
            const allProjects = await db
                .select({
                    project: projects,
                    client: clients,
                    team: teams
                })
                .from(projects)
                .leftJoin(clients, eq(projects.clientId, clients.id))
                .leftJoin(teams, eq(projects.teamId, teams.id))
                .orderBy(desc(projects.createdAt));
            
            return {
                projects: allProjects.map(p => {
                    // If project has a teamId and it's not one of God user's teams, mark as shared
                    const isOwned = !p.project.teamId || godUserTeamIds.has(p.project.teamId);
                    return {
                        ...p.project,
                        client: p.client,
                        team: p.team,
                        role: isOwned ? 'owner' : 'viewer',
                        isShared: !isOwned
                    };
                }),
                clients: []
            };
        } else {
            // Non-God users need a team
            return {
                projects: [],
                clients: []
            };
        }
    }
    
	const projects = await getProjectsByTeam(locals.team.id);
    const clients = await clientsService.getClientsByTeam(locals.team.id);

	return {
		projects,
        clients
	};
};

export const actions: Actions = {
    create: async ({ request, locals }) => {
        await requireAuth(locals);
        
        // Check if user is God
        const isGodUser = locals.user ? await isGod(locals.user.id) : false;
        
        // God users can create projects without a team context, others need a team
        if (!isGodUser && !locals.team) {
            return fail(400, { message: 'Team required for this operation' });
        }
        
        const formData = await request.formData();
        const name = formData.get('name') as string;
        const description = formData.get('description') as string;
        const clientId = formData.get('clientId') as string;

        const project = await createProject({
            name,
            description,
            teamId: locals.team?.id || null, // Allow null for God users
            clientId: clientId || null
        });

        return { success: true, id: project.id };
    }
};
