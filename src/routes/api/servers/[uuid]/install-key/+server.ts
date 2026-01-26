import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth, isGod } from '$lib/server/auth/permissions';
import { getServerById } from '$lib/server/services/servers';
import { installPrivateKeyViaPassword } from '$lib/server/services/security';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	await requireApiAuth(locals);
	const userIsGod = locals.user?.id ? await isGod(locals.user.id) : false;

	if (!locals.user) {
		return json({ message: 'Authentication required' }, { status: 401 });
	}

	if (!locals.team && !userIsGod) {
		return json({ message: 'Team context required' }, { status: 403 });
	}

	const { uuid } = params;
	if (!uuid) {
		return json({ message: 'Server UUID required' }, { status: 400 });
	}

	const server = await getServerById(uuid, locals.team?.id || null);
	if (!server) {
		return json({ message: 'Server not found' }, { status: 404 });
	}

	const body = await request.json();
	const { password, keyId } = body;

	if (!password) {
		return json({ message: 'Password is required' }, { status: 400 });
	}

	try {
		const result = await installPrivateKeyViaPassword({
			serverId: uuid,
			teamId: locals.team?.id || null,
			password,
			keyId,
			userId: locals.user.id
		});

		return json({
			data: {
				success: true,
				message: 'SSH access key installed successfully',
				privateKeyId: result.privateKeyId
			}
		});
	} catch (err: any) {
		return json({ message: err.message || 'Failed to install key' }, { status: 500 });
	}
};
