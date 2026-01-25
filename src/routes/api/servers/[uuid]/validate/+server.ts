import { json, error } from '@sveltejs/kit';
import { validateServerConnection } from '$lib/server/services/servers';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);
	
	const isGodUser = await isGod(locals.user!.id);
	
	if (!locals.team && !isGodUser) {
		throw error(403, 'Team or Admin privileges required');
	}

	const result = await validateServerConnection(params.uuid, locals.team?.id || null);

	return json(result);
};
