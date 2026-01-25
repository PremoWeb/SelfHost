import { json } from '@sveltejs/kit';
import { updateTeam } from '$lib/server/services/teams';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.team || locals.team.id !== params.uuid) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const team = await updateTeam(params.uuid, body);

	if (!team) {
		return json({ message: 'Team not found or update failed' }, { status: 404 });
	}

	return json({ data: team });
};
