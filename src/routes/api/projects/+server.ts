import { json } from '@sveltejs/kit';
import {
	getProjectsByTeam,
	createProject
} from '$lib/server/services/projects';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

/**
 * GET /api/projects
 * Get all projects for the current team
 */
export const GET: RequestHandler = async ({ locals }) => {
	await requireApiAuth(locals);

	if (!locals.team) {
		return json({ data: [] });
	}

	const projects = await getProjectsByTeam(locals.team.id);

	return json({ data: projects });
};

/**
 * POST /api/projects
 * Create a new project
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);
	
	// Check if user is God
	const { isGod } = await import('$lib/server/auth/permissions');
	const isGodUser = locals.user ? await isGod(locals.user.id) : false;
	
	// God users can create projects without a team context, others need a team
	if (!isGodUser && !locals.team) {
		return json({ message: 'Team required for this operation' }, { status: 400 });
	}

	const { name, description } = await request.json();

	if (!name) {
		return json({ message: 'Name is required' }, { status: 400 });
	}

	const project = await createProject({
		name,
		description,
		teamId: locals.team?.id || null // Allow null for God users
	});

	return json({ data: project }, { status: 201 });
};
