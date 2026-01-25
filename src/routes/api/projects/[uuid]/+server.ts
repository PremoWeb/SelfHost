import { json } from '@sveltejs/kit';
import {
	getProjectWithEnvironments,
	updateProject,
	deleteProject
} from '$lib/server/services/projects';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

/**
 * GET /api/projects/[uuid]
 * Get a single project with environments
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);

	const project = await getProjectWithEnvironments(params.uuid, locals.team?.id);

	if (!project) {
		return json({ message: 'Project not found' }, { status: 404 });
	}

	return json({ data: project });
};

/**
 * PATCH /api/projects/[uuid]
 * Update a project
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	await requireApiAuth(locals);
	
	// God users can update projects, but still need a teamId for the update
	// For now, require team even for god users (they can create a team first)
	if (!locals.team && !(await isGod(locals.user!.id))) {
		return json({ message: 'Team required for this operation' }, { status: 400 });
	}

	const { name, description } = await request.json();

	const project = await updateProject(params.uuid, locals.team.id, {
		name,
		description
	});

	if (!project) {
		return json({ message: 'Project not found' }, { status: 404 });
	}

	return json({ data: project });
};

/**
 * DELETE /api/projects/[uuid]
 * Delete a project
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);
	
	// God users can delete projects, but still need a teamId for the delete
	// For now, require team even for god users (they can create a team first)
	if (!locals.team && !(await isGod(locals.user!.id))) {
		return json({ message: 'Team required for this operation' }, { status: 400 });
	}

	const project = await deleteProject(params.uuid, locals.team.id);

	if (!project) {
		return json({ message: 'Project not found' }, { status: 404 });
	}

	return json({ message: 'Project deleted successfully' });
};
