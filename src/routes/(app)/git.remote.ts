import { command, getRequestEvent } from '$app/server';
import { requireAuth } from '$lib/server/auth/permissions';
import { createRepository } from '$lib/server/services/git';
import { getProjectById } from '$lib/server/services/projects';
import { getRepositoryById, updateRepositorySettings } from '$lib/server/services/git';
import { logAction } from '$lib/server/services/action-logger';

interface CreateRepositoryParams {
	projectId: string;
	name: string;
	description?: string | null;
	isPrivate?: boolean;
}

interface UpdateRepositorySettingsParams {
	repositoryId: string;
	name?: string;
	description?: string | null;
	isPrivate?: boolean;
	allowHttpPush?: boolean;
	allowSshPush?: boolean;
	isTemplate?: boolean;
	isReadOnly?: boolean;
}

export const createRepositoryRemote = command('unchecked', async (params: CreateRepositoryParams) => {
	const { locals, request, url, getClientAddress } = getRequestEvent();
	await requireAuth(locals);
	
	if (!locals.user) {
		return { success: false, message: 'Unauthorized' };
	}
	
	const { projectId, name, description, isPrivate } = params;
	
	if (!projectId || !name) {
		return { success: false, message: 'Project ID and repository name are required' };
	}
	
	// Validate repository name (lowercase, alphanumeric, hyphens only)
	if (!/^[a-z0-9-]+$/.test(name)) {
		return { success: false, message: 'Repository name must contain only lowercase letters, numbers, and hyphens' };
	}
	
	// Check if project exists and user has access
	const project = await getProjectById(projectId, locals.team?.id || null);
	if (!project) {
		return { success: false, message: 'Project not found' };
	}
	
	try {
		const repository = await createRepository({
			projectId,
			name,
			description: description || null,
			isPrivate: isPrivate || false
		});
		
		// Log action
		await logAction(locals, { request, url, getClientAddress } as any, {
			action: 'git.repository.create',
			resourceType: 'git_repository',
			resourceId: repository.id,
			method: 'POST',
			path: '/git.remote/createRepository',
			metadata: { projectId, name, isPrivate }
		});
		
		return { success: true, data: repository };
	} catch (err: any) {
		// Log failed action
		await logAction(locals, { request, url, getClientAddress } as any, {
			action: 'git.repository.create',
			resourceType: 'git_repository',
			method: 'POST',
			path: '/git.remote/createRepository',
			success: false,
			errorMessage: err.message || 'Failed to create repository',
			metadata: { projectId, name, isPrivate }
		});
		
		if (err.message?.includes('already exists')) {
			return { success: false, message: 'Repository already exists for this project' };
		}
		return { success: false, message: err.message || 'Failed to create repository' };
	}
});

export const updateRepositorySettingsRemote = command('unchecked', async (params: UpdateRepositorySettingsParams) => {
	const { locals, request, url, getClientAddress } = getRequestEvent();
	await requireAuth(locals);
	
	if (!locals.user) {
		return { success: false, message: 'Unauthorized' };
	}
	
	const { repositoryId, name, description, isPrivate, allowHttpPush, allowSshPush, isTemplate, isReadOnly } = params;
	
	const repository = await getRepositoryById(repositoryId);
	if (!repository) {
		return { success: false, message: 'Repository not found' };
	}
	
	try {
		const updated = await updateRepositorySettings(repositoryId, {
			name,
			description: description !== undefined ? description : undefined,
			isPrivate,
			allowHttpPush,
			allowSshPush,
			isTemplate,
			isReadOnly
		});
		
		// Log action
		await logAction(locals, { request, url, getClientAddress } as any, {
			action: 'git.repository.update',
			resourceType: 'git_repository',
			resourceId: repositoryId,
			method: 'PATCH',
			path: '/git.remote/updateRepositorySettings',
			metadata: { name, isPrivate, allowHttpPush, allowSshPush, isTemplate, isReadOnly }
		});
		
		return { success: true, data: updated };
	} catch (err: any) {
		// Log failed action
		await logAction(locals, { request, url, getClientAddress } as any, {
			action: 'git.repository.update',
			resourceType: 'git_repository',
			resourceId: repositoryId,
			method: 'PATCH',
			path: '/git.remote/updateRepositorySettings',
			success: false,
			errorMessage: err.message || 'Failed to update repository',
			metadata: { name, isPrivate, allowHttpPush, allowSshPush, isTemplate, isReadOnly }
		});
		
		return { success: false, message: err.message || 'Failed to update repository' };
	}
});
