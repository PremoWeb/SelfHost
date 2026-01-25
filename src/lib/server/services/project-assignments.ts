import { db } from '../db/client';
import { projectAssignments, projects } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';
import type { NewProjectAssignment } from '../db/schema';

/**
 * Assign a project to an individual, team, or company
 */
export async function assignProject(
	projectId: string,
	assigneeType: 'individual' | 'team' | 'company',
	assigneeId: string,
	role: 'owner' | 'admin' | 'editor' | 'viewer' = 'viewer'
) {
	// Check if assignment already exists
	const existing = await db
		.select()
		.from(projectAssignments)
		.where(
			and(
				eq(projectAssignments.projectId, projectId),
				eq(projectAssignments.assigneeType, assigneeType),
				eq(projectAssignments.assigneeId, assigneeId)
			)
		)
		.limit(1);

	if (existing.length > 0) {
		// Update existing assignment
		const [assignment] = await db
			.update(projectAssignments)
			.set({ role })
			.where(
				and(
					eq(projectAssignments.projectId, projectId),
					eq(projectAssignments.assigneeType, assigneeType),
					eq(projectAssignments.assigneeId, assigneeId)
				)
			)
			.returning();
		return assignment;
	}

	// Create new assignment
	const [assignment] = await db
		.insert(projectAssignments)
		.values({
			projectId,
			assigneeType,
			assigneeId,
			role
		})
		.returning();

	return assignment;
}

/**
 * Get all assignments for a project
 */
export async function getProjectAssignments(projectId: string) {
	return await db.query.projectAssignments.findMany({
		where: eq(projectAssignments.projectId, projectId)
	});
}

/**
 * Get all projects assigned to a user (via individual, team, or company)
 */
export async function getProjectsForUser(userId: string, teamIds: string[] = [], companyIds: string[] = []) {
	// Get individual assignments
	const individualAssignments = await db
		.select({
			assignment: projectAssignments,
			project: projects
		})
		.from(projectAssignments)
		.innerJoin(projects, eq(projectAssignments.projectId, projects.id))
		.where(and(eq(projectAssignments.assigneeType, 'individual'), eq(projectAssignments.assigneeId, userId)));

	// Get team assignments
	const teamAssignments =
		teamIds.length > 0
			? await db
					.select({
						assignment: projectAssignments,
						project: projects
					})
					.from(projectAssignments)
					.innerJoin(projects, eq(projectAssignments.projectId, projects.id))
					.where(
						and(
							eq(projectAssignments.assigneeType, 'team'),
							or(...teamIds.map((id) => eq(projectAssignments.assigneeId, id)))
						)
					)
			: [];

	// Get company assignments
	const companyAssignments =
		companyIds.length > 0
			? await db
					.select({
						assignment: projectAssignments,
						project: projects
					})
					.from(projectAssignments)
					.innerJoin(projects, eq(projectAssignments.projectId, projects.id))
					.where(
						and(
							eq(projectAssignments.assigneeType, 'company'),
							or(...companyIds.map((id) => eq(projectAssignments.assigneeId, id)))
						)
					)
			: [];

	// Combine and deduplicate by project ID
	const projectMap = new Map<string, { project: any; role: string; assigneeType: string }>();

	for (const item of [...individualAssignments, ...teamAssignments, ...companyAssignments]) {
		const existing = projectMap.get(item.project.id);
		// Keep the highest role (owner > admin > editor > viewer)
		const rolePriority = { owner: 4, admin: 3, editor: 2, viewer: 1 };
		if (!existing || rolePriority[item.assignment.role as keyof typeof rolePriority] > rolePriority[existing.role as keyof typeof rolePriority]) {
			projectMap.set(item.project.id, {
				project: item.project,
				role: item.assignment.role,
				assigneeType: item.assignment.assigneeType
			});
		}
	}

	return Array.from(projectMap.values());
}

/**
 * Remove an assignment
 */
export async function removeAssignment(assignmentId: string) {
	await db.delete(projectAssignments).where(eq(projectAssignments.id, assignmentId));
}

/**
 * Remove all assignments for a project
 */
export async function removeAllProjectAssignments(projectId: string) {
	await db.delete(projectAssignments).where(eq(projectAssignments.projectId, projectId));
}

/**
 * Check if a user has access to a project
 */
export async function hasProjectAccess(
	userId: string,
	projectId: string,
	teamIds: string[] = [],
	companyIds: string[] = []
): Promise<boolean> {
	// Check individual assignment
	const individual = await db
		.select()
		.from(projectAssignments)
		.where(
			and(
				eq(projectAssignments.projectId, projectId),
				eq(projectAssignments.assigneeType, 'individual'),
				eq(projectAssignments.assigneeId, userId)
			)
		)
		.limit(1);

	if (individual.length > 0) return true;

	// Check team assignments
	if (teamIds.length > 0) {
		const team = await db
			.select()
			.from(projectAssignments)
			.where(
				and(
					eq(projectAssignments.projectId, projectId),
					eq(projectAssignments.assigneeType, 'team'),
					or(...teamIds.map((id) => eq(projectAssignments.assigneeId, id)))
				)
			)
			.limit(1);

		if (team.length > 0) return true;
	}

	// Check company assignments
	if (companyIds.length > 0) {
		const company = await db
			.select()
			.from(projectAssignments)
			.where(
				and(
					eq(projectAssignments.projectId, projectId),
					eq(projectAssignments.assigneeType, 'company'),
					or(...companyIds.map((id) => eq(projectAssignments.assigneeId, id)))
				)
			)
			.limit(1);

		if (company.length > 0) return true;
	}

	return false;
}
