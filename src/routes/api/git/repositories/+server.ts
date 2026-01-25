import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/permissions';
import { createRepository } from '$lib/server/services/git';
import { getProjectById } from '$lib/server/services/projects';
import { logActionFromApi } from '$lib/server/services/action-logger';

/**
 * Create a new Git repository for a project
 */
export const POST: RequestHandler = async ({ request, locals, url, getClientAddress }) => {
	await requireAuth(locals);
	
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	
	const body = await request.json();
	const { projectId, name, description, isPrivate } = body;
	
	if (!projectId || !name) {
		throw error(400, 'Project ID and repository name are required');
	}
	
	// Validate repository name (lowercase, alphanumeric, hyphens only)
	if (!/^[a-z0-9-]+$/.test(name)) {
		throw error(400, 'Repository name must contain only lowercase letters, numbers, and hyphens');
	}
	
	// Check if project exists and user has access
	const project = await getProjectById(projectId, locals.team?.id || null);
	if (!project) {
		throw error(404, 'Project not found');
	}
	
	try {
		const repository = await createRepository({
			projectId,
			name,
			description: description || null,
			isPrivate: isPrivate || false
		});
		
		// Log action
		await logActionFromApi(locals, { request, url, getClientAddress }, 'git.repository.create', {
			resourceType: 'git_repository',
			resourceId: repository.id,
			metadata: { projectId, name, isPrivate }
		});
		
		return json(repository);
	} catch (err: any) {
		// Log failed action
		await logActionFromApi(locals, { request, url, getClientAddress }, 'git.repository.create', {
			resourceType: 'git_repository',
			success: false,
			errorMessage: err.message || 'Failed to create repository',
			metadata: { projectId, name, isPrivate }
		});
		
		if (err.message?.includes('already exists')) {
			throw error(409, 'Repository already exists for this project');
		}
		throw error(500, err.message || 'Failed to create repository');
	}
};
