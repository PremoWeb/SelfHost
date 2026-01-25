import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRepositoryByProjectId } from '$lib/server/services/git';
import { updateRepositoryStats } from '$lib/server/services/git';

/**
 * Git Smart HTTP Protocol - git-receive-pack endpoint (push)
 * Handles: POST /api/git/:projectId/:repoName/git-receive-pack
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { projectId, repoName } = params;
	
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	
	// Get repository
	const repository = await getRepositoryByProjectId(projectId);
	if (!repository || repository.name !== repoName) {
		throw error(404, 'Repository not found');
	}
	
	// Check write permissions
	// TODO: Implement permission checks
	
	if (!repository.allowHttpPush) {
		throw error(403, 'HTTP push is disabled for this repository');
	}
	
	const repoPath = repository.repositoryPath;
	
	try {
		// Get request body as stream
		const body = await request.arrayBuffer();
		
		// Execute git receive-pack
		const { spawn } = await import('child_process');
		const gitProcess = spawn('git', ['-C', repoPath, 'receive-pack', '--stateless-rpc', '.'], {
			stdio: ['pipe', 'pipe', 'pipe']
		});
		
		// Write request body to git process
		gitProcess.stdin?.write(Buffer.from(body));
		gitProcess.stdin?.end();
		
		// Collect output
		let stdout = Buffer.alloc(0);
		let stderr = Buffer.alloc(0);
		
		gitProcess.stdout?.on('data', (chunk) => {
			stdout = Buffer.concat([stdout, chunk]);
		});
		
		gitProcess.stderr?.on('data', (chunk) => {
			stderr = Buffer.concat([stderr, chunk]);
		});
		
		// Wait for process to complete
		await new Promise<void>((resolve, reject) => {
			gitProcess.on('close', (code) => {
				if (code !== 0 && code !== null) {
					reject(new Error(`git receive-pack failed: ${stderr.toString()}`));
				} else {
					resolve();
				}
			});
			gitProcess.on('error', reject);
		});
		
		// Update repository statistics after push
		await updateRepositoryStats(repository.id).catch(() => {
			// Silently fail - stats update shouldn't break the push
		});
		
		return new Response(stdout, {
			headers: {
				'Content-Type': 'application/x-git-receive-pack-result',
				'Cache-Control': 'no-cache'
			}
		});
	} catch (err: any) {
		throw error(500, 'Failed to execute git receive-pack');
	}
};
