import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRepositoryByNamespace } from '$lib/server/services/git';
import { getUserTeams } from '$lib/server/auth/session';
import { hasRepositoryAccess } from '$lib/server/services/git';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Git Smart HTTP Protocol - info/refs endpoint (friendly namespace format)
 * Handles: GET /:namespace/:repoName.git/info/refs?service=git-upload-pack
 *         GET /:namespace/:repoName.git/info/refs?service=git-receive-pack
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const { namespace, repoName } = params;
	const service = url.searchParams.get('service');
	
	if (!service || !['git-upload-pack', 'git-receive-pack'].includes(service)) {
		throw error(400, 'Invalid service parameter');
	}
	
	// Get repository by namespace and name
	const repository = await getRepositoryByNamespace(namespace, repoName);
	if (!repository) {
		throw error(404, 'Repository not found');
	}
	
	// Check permissions based on service type
	if (locals.user) {
		const teams = await getUserTeams(locals.user.id);
		const teamIds = teams.map(t => t.team.id);
		const requiredPermission = service === 'git-upload-pack' ? 'read' : 'write';
		const hasAccess = await hasRepositoryAccess(repository.id, locals.user.id, teamIds, requiredPermission);
		
		if (!hasAccess) {
			throw error(403, 'Access denied');
		}
		
		// Check if operation is allowed
		if (service === 'git-receive-pack' && !repository.allowHttpPush) {
			throw error(403, 'HTTP push is disabled for this repository');
		}
	} else if (service === 'git-receive-pack') {
		// Push requires authentication
		throw error(401, 'Authentication required');
	} else if (repository.isPrivate) {
		// Private repositories require authentication for read
		throw error(401, 'Authentication required');
	}
	
	const repoPath = repository.repositoryPath;
	
	try {
		// Execute git command to get refs
		const { stdout } = await execAsync(`git -C "${repoPath}" ${service} --stateless-rpc --advertise-refs .`);
		
		// Format response according to Git Smart HTTP protocol
		const serviceLine = `# service=${service}\n`;
		const pktLine = String.fromCharCode(serviceLine.length + 4) + serviceLine;
		const flushPkt = '0000';
		
		return new Response(pktLine + flushPkt + stdout, {
			headers: {
				'Content-Type': `application/x-${service}-advertisement`,
				'Cache-Control': 'no-cache'
			}
		});
	} catch (err: any) {
		throw error(500, 'Failed to get repository refs');
	}
};
