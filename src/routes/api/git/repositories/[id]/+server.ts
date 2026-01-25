import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/permissions';
import { getRepositoryById, updateRepositorySettings } from '$lib/server/services/git';
import { logActionFromApi } from '$lib/server/services/action-logger';

/**
 * Get repository by ID
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	await requireAuth(locals);
	
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	
	const repository = await getRepositoryById(params.id);
	if (!repository) {
		throw error(404, 'Repository not found');
	}
	
	return json(repository);
};

/**
 * Update repository settings
 */
export const PATCH: RequestHandler = async ({ params, request, locals, url, getClientAddress }) => {
	await requireAuth(locals);
	
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	
	const repository = await getRepositoryById(params.id);
	if (!repository) {
		throw error(404, 'Repository not found');
	}
	
	const body = await request.json();
	const { name, description, isPrivate, allowHttpPush, allowSshPush, isTemplate, isReadOnly } = body;
	
	try {
		const updated = await updateRepositorySettings(params.id, {
			name,
			description: description !== undefined ? description : undefined,
			isPrivate,
			allowHttpPush,
			allowSshPush,
			isTemplate,
			isReadOnly
		});
		
		// Log action
		await logActionFromApi(locals, { request, url, getClientAddress }, 'git.repository.update', {
			resourceType: 'git_repository',
			resourceId: params.id,
			metadata: { name, isPrivate, allowHttpPush, allowSshPush, isTemplate, isReadOnly }
		});
		
		return json(updated);
	} catch (err: any) {
		// Log failed action
		await logActionFromApi(locals, { request, url, getClientAddress }, 'git.repository.update', {
			resourceType: 'git_repository',
			resourceId: params.id,
			success: false,
			errorMessage: err.message || 'Failed to update repository',
			metadata: { name, isPrivate, allowHttpPush, allowSshPush, isTemplate, isReadOnly }
		});
		
		throw error(500, err.message || 'Failed to update repository');
	}
};
