import { json } from '@sveltejs/kit';
import { deleteApiToken } from '$lib/server/services/api-tokens';
import { requireApiAuth, requireTeam } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);
	await requireTeam(locals);

	await deleteApiToken(params.uuid, locals.team.id);

	return json({ message: 'API token deleted successfully' });
};
