import { error, fail } from '@sveltejs/kit';
import { getProjectWithEnvironments, getSharedTeamsForProject, shareProject, unshareProject, updateProject } from '$lib/server/services/projects';
import { getAllTeams } from '$lib/server/services/teams';
import { clientsService } from '$lib/server/services/clients';
import { requireAuth, isGod } from '$lib/server/auth/permissions';
import { logActionFromForm } from '$lib/server/services/action-logger';
import { getRepositoryByProjectId, getRepositoryNamespace } from '$lib/server/services/git';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	await requireAuth(locals);
	
	// God users can view any project, others need a team
	if (!locals.team && !(await isGod(locals.user!.id))) {
		throw error(400, 'Team required to view project');
	}
	
	// For god users, we need to find the project without team context
	// For now, if no team, try to get project by UUID directly
	const project = locals.team 
		? await getProjectWithEnvironments(params.uuid, locals.team.id)
		: await getProjectWithEnvironments(params.uuid, null);

	if (!project) {
		throw error(404, 'Project not found');
	}

    // Only load sharing info if user is owner?
    // For now load it, UI can hide it.
    const sharedTeams = await getSharedTeamsForProject(project.id);
    
    // For God users without team context, show all teams
    // For others, show all teams excluding the current team
    const isGodUser = await isGod(locals.user!.id);
    const allTeams = isGodUser && !locals.team
        ? await getAllTeams() // God mode: show all teams
        : locals.team
            ? await getAllTeams(locals.team.id) // Exclude current team
            : [];
    
    const clients = locals.team ? await clientsService.getClientsByTeam(locals.team.id) : [];
    
    // Load Git repository for this project
    const gitRepository = await getRepositoryByProjectId(project.id);
    
    // Get namespace for friendly URLs
    let namespace: string | null = null;
    if (gitRepository) {
        namespace = await getRepositoryNamespace(gitRepository.id);
    }

	return {
		project,
        sharedTeams,
        allTeams,
        clients,
        gitRepository: gitRepository ? { ...gitRepository, namespace } : null
	};
};

export const actions: Actions = {
    share: async (event) => {
        await requireAuth(event.locals);
        if (!event.locals.team && !(await isGod(event.locals.user!.id))) {
            return fail(400, { message: 'Team required for this operation' });
        }
        const formData = await event.request.formData();
        const teamId = formData.get('teamId') as string;
        const role = formData.get('role') as string || 'viewer';
        
        try {
            await shareProject(event.params.uuid, teamId, role);
            
            // Log action
            await logActionFromForm(event.locals, event, 'project.share', {
                resourceType: 'project',
                resourceId: event.params.uuid,
                metadata: { teamId, role }
            }, formData);
            
            return { success: true };
        } catch (e: any) {
            // Log failed action
            await logActionFromForm(event.locals, event, 'project.share', {
                resourceType: 'project',
                resourceId: event.params.uuid,
                success: false,
                errorMessage: e.message || 'Failed to share project',
                metadata: { teamId, role }
            }, formData);
            return fail(500, { message: 'Failed to share project' });
        }
    },
    update: async (event) => {
        await requireAuth(event.locals);
        if (!event.locals.team && !(await isGod(event.locals.user!.id))) {
            return fail(400, { message: 'Team required for this operation' });
        }
        const formData = await event.request.formData();
        const name = formData.get('name') as string;
        const description = formData.get('description') as string;
        const clientId = formData.get('clientId') as string;

        try {
            await updateProject(event.params.uuid, event.locals.team?.id || null, {
                name,
                description,
                clientId: clientId || null
            });
            
            // Log action
            await logActionFromForm(event.locals, event, 'project.update', {
                resourceType: 'project',
                resourceId: event.params.uuid,
                metadata: { name, description, clientId }
            }, formData);
            
            return { success: true };
        } catch (e: any) {
            // Log failed action
            await logActionFromForm(event.locals, event, 'project.update', {
                resourceType: 'project',
                resourceId: event.params.uuid,
                success: false,
                errorMessage: e.message || 'Failed to update project',
                metadata: { name, description, clientId }
            }, formData);
            return fail(500, { message: e.message || 'Failed to update project' });
        }
    },
    unshare: async (event) => {
        await requireAuth(event.locals);
        if (!event.locals.team && !(await isGod(event.locals.user!.id))) {
            return fail(400, { message: 'Team required for this operation' });
        }
        const formData = await event.request.formData();
        const teamId = formData.get('teamId') as string;
        
        try {
            await unshareProject(event.params.uuid, teamId);
            
            // Log action
            await logActionFromForm(event.locals, event, 'project.unshare', {
                resourceType: 'project',
                resourceId: event.params.uuid,
                metadata: { teamId }
            }, formData);
            
            return { success: true };
        } catch (e: any) {
            // Log failed action
            await logActionFromForm(event.locals, event, 'project.unshare', {
                resourceType: 'project',
                resourceId: event.params.uuid,
                success: false,
                errorMessage: e.message || 'Failed to unshare project',
                metadata: { teamId }
            }, formData);
             return fail(500, { message: 'Failed to unshare project' });
        }
    }
};
