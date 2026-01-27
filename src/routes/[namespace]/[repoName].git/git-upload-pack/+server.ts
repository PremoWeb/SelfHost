import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRepositoryByNamespace } from '$lib/server/services/git';
import { getUserTeams } from '$lib/server/auth/session';
import { hasRepositoryAccess } from '$lib/server/services/git';
import { spawn } from 'node:child_process';

/**
 * Git Smart HTTP Protocol - git-upload-pack endpoint (friendly namespace format)
 * Handles: POST /:namespace/:repoName.git/git-upload-pack
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { namespace, repoName } = params;
	
	// Get repository by namespace and name
	const repository = await getRepositoryByNamespace(namespace, repoName);
	if (!repository) {
		throw error(404, 'Repository not found');
	}
	
	// Check read permissions
	if (locals.user) {
		const teams = await getUserTeams(locals.user.id);
		const teamIds = teams.map(t => t.team.id);
		const hasAccess = await hasRepositoryAccess(repository.id, locals.user.id, teamIds, 'read');
		
		if (!hasAccess) {
			throw error(403, 'Access denied');
		}
	} else if (repository.isPrivate) {
		throw error(401, 'Authentication required');
	}
	
	const repoPath = repository.repositoryPath;
	
	try {
		const body = await request.arrayBuffer();
		
		const gitProcess = spawn('git', ['-C', repoPath, 'upload-pack', '--stateless-rpc', '.'], {
			stdio: ['pipe', 'pipe', 'pipe']
		});
		
		gitProcess.stdin?.write(Buffer.from(body));
		gitProcess.stdin?.end();
		
		let stdout = Buffer.alloc(0);
		let stderr = Buffer.alloc(0);
		
		gitProcess.stdout?.on('data', (chunk) => {
			stdout = Buffer.concat([stdout, chunk]);
		});
		
		gitProcess.stderr?.on('data', (chunk) => {
			stderr = Buffer.concat([stderr, chunk]);
		});
		
		await new Promise<void>((resolve, reject) => {
			gitProcess.on('close', (code) => {
				if (code !== 0 && code !== null) {
					reject(new Error(`git upload-pack failed: ${stderr.toString()}`));
				} else {
					resolve();
				}
			});
			gitProcess.on('error', reject);
		});
		
		return new Response(stdout, {
			headers: {
				'Content-Type': 'application/x-git-upload-pack-result',
				'Cache-Control': 'no-cache'
			}
		});
	} catch (err: any) {
		throw error(500, 'Failed to execute git upload-pack');
	}
};
