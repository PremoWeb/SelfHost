import { json } from '@sveltejs/kit';
import { getSharedVariablesByTeam, createSharedVariable, updateSharedVariable, deleteSharedVariable } from '$lib/server/services/variables';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	await requireApiAuth(locals);

	if (!locals.team) {
		return json({ data: [] });
	}

	const vars = await getSharedVariablesByTeam(locals.team.id);
	return json({ data: vars });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);
	
	// God users can create variables, but still need a teamId for the variable
	// For now, require team even for god users (they can create a team first)
	if (!locals.team) {
		return json({ message: 'Team required for this operation' }, { status: 400 });
	}

	const { key, value, isPublic } = await request.json();

	if (!key || value === undefined) {
		return json({ message: 'Key and Value are required' }, { status: 400 });
	}

	const variable = await createSharedVariable({
		key,
		value,
		isPublic: !!isPublic,
		teamId: locals.team.id
	});

	return json({ data: variable }, { status: 201 });
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
    // This will handle individual variable updates if we pass an ID in the body
    // or we could use [uuid] route. For simplicity, let's keep it in the list for now.
    return json({ message: 'Not implemented' }, { status: 501 });
}
