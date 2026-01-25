import { json } from '@sveltejs/kit';
import { getSourcesByTeam, createSource } from '$lib/server/services/sources';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	await requireApiAuth(locals);

	if (!locals.team) {
		return json({ data: [] });
	}

	const sources = await getSourcesByTeam(locals.team.id);
	return json({ data: sources });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);
	
	// God users can create sources, but still need a teamId for the source
	// For now, require team even for god users (they can create a team first)
	if (!locals.team) {
		return json({ message: 'Team required for this operation' }, { status: 400 });
	}

	const { name, description, type, apiUrl, htmlUrl, token } = await request.json();

	if (!name || !type) {
		return json({ message: 'Name and Type are required' }, { status: 400 });
	}

	const source = await createSource({
		name,
		description,
		type,
		apiUrl,
		htmlUrl,
		token,
		teamId: locals.team.id
	});

	return json({ data: source }, { status: 201 });
};
