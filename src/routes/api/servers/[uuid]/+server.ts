import { json } from '@sveltejs/kit';
import { getServerById, updateServer, deleteServer } from '$lib/server/services/servers';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);

	const server = await getServerById(params.uuid, locals.team?.id);

	if (!server) {
		return json({ message: 'Server not found' }, { status: 404 });
	}

	return json({ data: server });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	await requireApiAuth(locals);
	
	// God users can update servers, but still need a teamId for the update
	// For now, require team even for god users (they can create a team first)
	if (!locals.team && !(await isGod(locals.user!.id))) {
		return json({ message: 'Team required for this operation' }, { status: 400 });
	}

	const body = await request.json();
	const teamId = locals.team?.id;
	
	if (!teamId) {
		return json({ message: 'Team ID is required' }, { status: 400 });
	}
	
	const server = await updateServer(params.uuid, teamId, body);

	if (!server) {
		return json({ message: 'Server not found or update failed' }, { status: 404 });
	}

	return json({ data: server });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);
	
	// God users can delete servers, but still need a teamId for the delete
	// For now, require team even for god users (they can create a team first)
	if (!locals.team && !(await isGod(locals.user!.id))) {
		return json({ message: 'Team required for this operation' }, { status: 400 });
	}

	const teamId = locals.team?.id;
	
	if (!teamId) {
		return json({ message: 'Team ID is required' }, { status: 400 });
	}

	const server = await deleteServer(params.uuid, teamId);

	if (!server) {
		return json({ message: 'Server not found or deletion failed' }, { status: 404 });
	}

	return json({ message: 'Server deleted successfully' });
};
