import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRepositoryByProjectId } from '$lib/server/services/git';
import { spawn } from 'node:child_process';

/**
 * Git Smart HTTP Protocol - git-upload-pack endpoint (pull/clone)
 * Handles: POST /api/git/:projectId/:repoName/git-upload-pack
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { projectId, repoName } = params;
	
	// Get repository
	const repository = await getRepositoryByProjectId(projectId);
	if (!repository || repository.name !== repoName) {
		throw error(404, 'Repository not found');
	}
	
	// Check read permissions
	// TODO: Implement permission checks
	
	const repoPath = repository.repositoryPath;
	
	try {
		// Get request body as stream
		const body = await request.arrayBuffer();
		
		// Execute git upload-pack
		const gitProcess = spawn('git', ['-C', repoPath, 'upload-pack', '--stateless-rpc', '.'], {
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
