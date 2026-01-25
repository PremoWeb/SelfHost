import { json } from '@sveltejs/kit';
import { getDestinationsByTeam, createDestination } from '$lib/server/services/destinations';
import { requireApiAuth } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	await requireApiAuth(locals);

	// Super admins can access all destinations, regular users need a team
	if (!locals.team) {
		return json({ data: [] }); // Super admin without team gets empty list
	}

	const dests = await getDestinationsByTeam(locals.team.id);
	return json({ data: dests });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);

	// God users can create destinations, but still need a teamId for the destination
	// For now, require team even for god users (they can create a team first)
	if (!locals.team) {
		return json({ message: 'Team required for creating destinations' }, { status: 400 });
	}

	const { name, description, serverId, type, network } = await request.json();

	if (!name || !serverId || !type) {
		return json({ message: 'Name, Server, and Type are required' }, { status: 400 });
	}

	const dest = await createDestination({
		name,
		description,
		serverId,
		type,
		network: network || 'selfhost',
		teamId: locals.team.id
	});

	return json({ data: dest }, { status: 201 });
};
