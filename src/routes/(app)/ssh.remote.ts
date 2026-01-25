import { command, getRequestEvent } from '$app/server';
import { requireAuth } from '$lib/server/auth/permissions';
import { addSshKey, deleteSshKey } from '$lib/server/services/git';
import { logAction } from '$lib/server/services/action-logger';

interface AddSshKeyParams {
	title: string;
	publicKey: string;
}

export const addSshKeyRemote = command('unchecked', async (params: AddSshKeyParams) => {
	const { locals, request, url, getClientAddress } = getRequestEvent();
	await requireAuth(locals);
	
	if (!locals.user) {
		return { success: false, message: 'Unauthorized' };
	}
	
	const { title, publicKey } = params;
	
	if (!title || !publicKey) {
		return { success: false, message: 'Title and public key are required' };
	}
	
	try {
		const key = await addSshKey(locals.user.id, title.trim(), publicKey.trim());
		
		// Log action
		await logAction(locals, { request, url, getClientAddress } as any, {
			action: 'ssh.key.add',
			resourceType: 'ssh_key',
			resourceId: key.id,
			method: 'POST',
			path: '/ssh.remote/addSshKey',
			metadata: { title, keyType: key.keyType }
		});
		
		return { success: true, data: key };
	} catch (err: any) {
		// Log failed action
		await logAction(locals, { request, url, getClientAddress } as any, {
			action: 'ssh.key.add',
			resourceType: 'ssh_key',
			method: 'POST',
			path: '/ssh.remote/addSshKey',
			success: false,
			errorMessage: err.message || 'Failed to add SSH key',
			metadata: { title }
		});
		
		if (err.message?.includes('already exists')) {
			return { success: false, message: 'SSH key already exists' };
		}
		if (err.message?.includes('Invalid')) {
			return { success: false, message: err.message };
		}
		return { success: false, message: err.message || 'Failed to add SSH key' };
	}
});

export const deleteSshKeyRemote = command('unchecked', async ({ keyId }: { keyId: string }) => {
	const { locals, request, url, getClientAddress } = getRequestEvent();
	await requireAuth(locals);
	
	if (!locals.user) {
		return { success: false, message: 'Unauthorized' };
	}
	
	try {
		await deleteSshKey(keyId, locals.user.id);
		
		// Log action
		await logAction(locals, { request, url, getClientAddress } as any, {
			action: 'ssh.key.delete',
			resourceType: 'ssh_key',
			resourceId: keyId,
			method: 'DELETE',
			path: '/ssh.remote/deleteSshKey'
		});
		
		return { success: true };
	} catch (err: any) {
		// Log failed action
		await logAction(locals, { request, url, getClientAddress } as any, {
			action: 'ssh.key.delete',
			resourceType: 'ssh_key',
			resourceId: keyId,
			method: 'DELETE',
			path: '/ssh.remote/deleteSshKey',
			success: false,
			errorMessage: err.message || 'Failed to delete SSH key'
		});
		
		if (err.message?.includes('not found') || err.message?.includes('not authorized')) {
			return { success: false, message: err.message };
		}
		return { success: false, message: err.message || 'Failed to delete SSH key' };
	}
});
