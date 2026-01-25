import { db } from '../db/client';
import { projects, environments, sharedProjects, teams, clients, projectAssignments } from '../db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import type { NewProject } from '../db/schema';
import { getProjectsForUser, hasProjectAccess } from './project-assignments';

/**
 * Get all projects for a team, including shared ones (backward compatibility)
 * Also supports new assignment model
 */
export async function getProjectsByTeam(teamId: string | null | undefined) {
	if (!teamId) return [];

    // Get projects via teamId (backward compatibility)
    const ownedProjects = await db
        .select({
            project: projects,
            client: clients
        })
        .from(projects)
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(eq(projects.teamId, teamId));

    // Get projects via team assignment
    const teamAssignedProjects = await db
        .select({
            project: projects,
            assignment: projectAssignments,
            client: clients
        })
        .from(projectAssignments)
        .innerJoin(projects, eq(projectAssignments.projectId, projects.id))
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(and(
            eq(projectAssignments.assigneeType, 'team'),
            eq(projectAssignments.assigneeId, teamId)
        ));

    // Get shared projects (legacy)
    const shared = await db
        .select({
            project: projects,
            role: sharedProjects.role,
            client: clients
        })
        .from(sharedProjects)
        .innerJoin(projects, eq(sharedProjects.projectId, projects.id))
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(eq(sharedProjects.teamId, teamId));

    const all = [
        ...ownedProjects.map(p => ({ ...p.project, client: p.client, role: 'owner', isShared: false })),
        ...teamAssignedProjects.map(p => ({ ...p.project, client: p.client, role: p.assignment.role, isShared: false })),
        ...shared.map(s => ({ ...s.project, client: s.client, role: s.role, isShared: true }))
    ];
    
    // Deduplicate by project ID, keeping highest role
    const projectMap = new Map();
    for (const item of all) {
        const existing = projectMap.get(item.id);
        const rolePriority = { owner: 4, admin: 3, editor: 2, viewer: 1 };
        if (!existing || rolePriority[item.role as keyof typeof rolePriority] > rolePriority[existing.role as keyof typeof rolePriority]) {
            projectMap.set(item.id, item);
        }
    }
    
    return Array.from(projectMap.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get project by UUID checking both ownership and shared access
 * Supports both teamId (backward compatibility) and new assignment model
 */
export async function getProjectById(projectId: string, teamId: string | null | undefined) {
    if (!teamId) {
        // Try to get project without team context (for god mode or individual assignments)
        const [project] = await db
            .select({
                project: projects,
                client: clients
            })
            .from(projects)
            .leftJoin(clients, eq(projects.clientId, clients.id))
            .where(eq(projects.id, projectId))
            .limit(1);
        
        if (project) {
            return { ...project.project, client: project.client, role: 'owner', isShared: false };
        }
        return null;
    }

    // Check ownership via teamId (backward compatibility)
	const [owned] = await db
		.select({
            project: projects,
            client: clients
        })
		.from(projects)
        .leftJoin(clients, eq(projects.clientId, clients.id))
		.where(and(eq(projects.id, projectId), eq(projects.teamId, teamId)))
		.limit(1);

    if (owned) return { ...owned.project, client: owned.client, role: 'owner', isShared: false };

    // Check team assignment
    const [teamAssigned] = await db
        .select({
            project: projects,
            assignment: projectAssignments,
            client: clients
        })
        .from(projectAssignments)
        .innerJoin(projects, eq(projectAssignments.projectId, projects.id))
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(and(
            eq(projectAssignments.projectId, projectId),
            eq(projectAssignments.assigneeType, 'team'),
            eq(projectAssignments.assigneeId, teamId)
        ))
        .limit(1);

    if (teamAssigned) {
        return { ...teamAssigned.project, client: teamAssigned.client, role: teamAssigned.assignment.role, isShared: false };
    }

    // Check shared access (legacy)
    const [shared] = await db
        .select({
            project: projects,
            role: sharedProjects.role,
            client: clients
        })
        .from(sharedProjects)
        .innerJoin(projects, eq(sharedProjects.projectId, projects.id))
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(and(
            eq(sharedProjects.projectId, projectId),
            eq(sharedProjects.teamId, teamId)
        ))
        .limit(1);

	if (shared) {
        return { ...shared.project, client: shared.client, role: shared.role, isShared: true };
    }

    return null;
}

/**
 * Get project with environments
 * Supports both teamId (backward compatibility) and new assignment model
 */
export async function getProjectWithEnvironments(projectId: string, teamId: string | null | undefined) {
	const project = await getProjectById(projectId, teamId);

	if (!project) return null;

	const projectEnvironments = await db
		.select()
		.from(environments)
		.where(eq(environments.projectId, projectId))
		.orderBy(environments.createdAt);

	return {
		...project,
		environments: projectEnvironments
	};
}

/**
 * Create a new project
 */
export async function createProject(data: NewProject) {
	const [project] = await db.insert(projects).values(data).returning();

	// Create default environment
	await db.insert(environments).values({
		name: 'production',
		description: 'Production environment',
		projectId: project.id
	});

	return { ...project, role: 'owner', isShared: false };
}

/**
 * Update a project
 * Supports both teamId (backward compatibility) and new assignment model
 */
export async function updateProject(
	projectId: string,
	teamId: string | null | undefined,
	data: Partial<NewProject>
) {
    // Validate access (allow owner or editor/admin)
    const current = await getProjectById(projectId, teamId);
    if (!current) return null;
    
    if (current.isShared && current.role === 'viewer') {
        throw new Error('Insufficient permissions');
    }

	const [project] = await db
		.update(projects)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(projects.id, projectId)) // Already validated existence and permission above
		.returning();

	return project || null;
}

/**
 * Delete a project
 * Supports both teamId (backward compatibility) and new assignment model
 * Only owner can delete
 */
export async function deleteProject(projectId: string, teamId: string | null | undefined) {
    // Validate access - must be owner
    const current = await getProjectById(projectId, teamId);
    if (!current) return null;
    
    // Only owner can delete
    if (current.isShared || current.role !== 'owner') {
        throw new Error('Only project owner can delete');
    }
    
    const [project] = await db
		.delete(projects)
		.where(eq(projects.id, projectId))
		.returning();

	return project || null;
}

/**
 * Get teams that have access to this project
 */
export async function getSharedTeamsForProject(projectId: string) {
    return db
        .select({
            team: teams,
            role: sharedProjects.role,
            sharedAt: sharedProjects.createdAt
        })
        .from(sharedProjects)
        .innerJoin(teams, eq(sharedProjects.teamId, teams.id))
        .where(eq(sharedProjects.projectId, projectId));
}

/**
 * Share project with a team
 */
export async function shareProject(projectId: string, teamId: string, role: string) {
    return db.insert(sharedProjects).values({
        projectId,
        teamId,
        role
    }).onConflictDoUpdate({
        target: [sharedProjects.projectId, sharedProjects.teamId],
        set: { role, updatedAt: new Date() }
    }).returning();
}

/**
 * Remove shared access
 */
export async function unshareProject(projectId: string, teamId: string) {
    return db.delete(sharedProjects)
        .where(and(
            eq(sharedProjects.projectId, projectId),
            eq(sharedProjects.teamId, teamId)
        ))
        .returning();
}
