import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRepositoryByProjectId, getSshKeyByFingerprint, calculateFingerprint, hasRepositoryAccess } from '$lib/server/services/git';
import { getUserTeams } from '$lib/server/auth/session';

/**
 * Authorize SSH git operation
 * Called by gitpremo-shell.sh to verify access
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const { projectId, repoName, operation, publicKey } = body;
		
		if (!projectId || !repoName || !operation || !publicKey) {
			throw error(400, 'Missing required parameters');
		}
		
		// Get repository
		const repository = await getRepositoryByProjectId(projectId);
		if (!repository || repository.name !== repoName) {
			throw error(404, 'Repository not found');
		}
		
		// Find SSH key
		const fingerprint = calculateFingerprint(publicKey);
		const sshKey = await getSshKeyByFingerprint(fingerprint);
		
		if (!sshKey) {
			return json({ authorized: false, message: 'SSH key not found' });
		}
		
		// Get user's teams
		const teams = await getUserTeams(sshKey.userId);
		const teamIds = teams.map(t => t.team.id);
		
		// Check permissions based on operation
		const requiredPermission = operation === 'upload-pack' ? 'read' : 'write';
		const hasAccess = await hasRepositoryAccess(repository.id, sshKey.userId, teamIds, requiredPermission);
		
		if (!hasAccess) {
			return json({ authorized: false, message: 'Access denied' });
		}
		
		// Check if operation is allowed
		if (operation === 'receive-pack' && !repository.allowSshPush) {
			return json({ authorized: false, message: 'SSH push is disabled for this repository' });
		}
		
		// Update last used timestamp
		const { db } = await import('$lib/server/db/client');
		const { sshKeys: sshKeysTable } = await import('$lib/server/db/git-schema');
		const { eq } = await import('drizzle-orm');
		
		await db
			.update(sshKeysTable)
			.set({ lastUsedAt: new Date() })
			.where(eq(sshKeysTable.id, sshKey.id));
		
		return json({
			authorized: true,
			repositoryPath: repository.repositoryPath
		});
	} catch (err: any) {
		return json({ authorized: false, message: err.message || 'Authorization failed' }, { status: 500 });
	}
};
