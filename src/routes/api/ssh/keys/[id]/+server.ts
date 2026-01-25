import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/permissions';
import { deleteSshKey } from '$lib/server/services/git';
import { logActionFromApi } from '$lib/server/services/action-logger';

/**
 * Delete an SSH key
 */
export const DELETE: RequestHandler = async ({ params, locals, url, getClientAddress, request }) => {
	await requireAuth(locals);
	
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	
	try {
		await deleteSshKey(params.id, locals.user.id);
		
		// Log action
		await logActionFromApi(locals, { request, url, getClientAddress }, 'ssh.key.delete', {
			resourceType: 'ssh_key',
			resourceId: params.id
		});
		
		return json({ success: true });
	} catch (err: any) {
		// Log failed action
		await logActionFromApi(locals, { request, url, getClientAddress }, 'ssh.key.delete', {
			resourceType: 'ssh_key',
			resourceId: params.id,
			success: false,
			errorMessage: err.message || 'Failed to delete SSH key'
		});
		
		if (err.message?.includes('not found') || err.message?.includes('not authorized')) {
			throw error(404, err.message);
		}
		throw error(500, err.message || 'Failed to delete SSH key');
	}
};
