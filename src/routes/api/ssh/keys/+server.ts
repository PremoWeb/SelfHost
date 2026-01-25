import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/permissions';
import { getUserSshKeys, addSshKey } from '$lib/server/services/git';
import { logActionFromApi } from '$lib/server/services/action-logger';

/**
 * Get all SSH public keys for the git user
 * Called by SSH AuthorizedKeysCommand
 */
export const GET: RequestHandler = async () => {
	try {
		// Get all SSH keys from database
		// For now, return all keys - in production you might want to filter by active users
		const { db } = await import('$lib/server/db/client');
		const { sshKeys } = await import('$lib/server/db/git-schema');
		
		const keys = await db.select({
			publicKey: sshKeys.publicKey
		}).from(sshKeys);
		
		return json(keys.map(k => ({ publicKey: k.publicKey })));
	} catch (error) {
		return json([], { status: 500 });
	}
};

/**
 * Add a new SSH key for the authenticated user
 */
export const POST: RequestHandler = async ({ request, locals, url, getClientAddress }) => {
	await requireAuth(locals);
	
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	
	const body = await request.json();
	const { title, publicKey } = body;
	
	if (!title || !publicKey) {
		throw error(400, 'Title and public key are required');
	}
	
	try {
		const key = await addSshKey(locals.user.id, title.trim(), publicKey.trim());
		
		// Log action
		await logActionFromApi(locals, { request, url, getClientAddress }, 'ssh.key.add', {
			resourceType: 'ssh_key',
			resourceId: key.id,
			metadata: { title, keyType: key.keyType }
		});
		
		return json(key);
	} catch (err: any) {
		// Log failed action
		await logActionFromApi(locals, { request, url, getClientAddress }, 'ssh.key.add', {
			resourceType: 'ssh_key',
			success: false,
			errorMessage: err.message || 'Failed to add SSH key',
			metadata: { title }
		});
		
		if (err.message?.includes('already exists')) {
			throw error(409, 'SSH key already exists');
		}
		if (err.message?.includes('Invalid')) {
			throw error(400, err.message);
		}
		throw error(500, err.message || 'Failed to add SSH key');
	}
};
