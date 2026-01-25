import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth } from '$lib/server/auth/permissions';
import { isGod, isSuperAdmin } from '$lib/server/auth/permissions';
import {
	addCategoryCollaboration,
	removeCategoryCollaboration,
	getCategoryCollaborations
} from '$lib/server/services/project-categories';

/**
 * GET /api/project-categories/[id]/collaborations
 * Get collaborations for a category
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);

	const collaborations = await getCategoryCollaborations(params.id);
	return json({ data: collaborations });
};

/**
 * POST /api/project-categories/[id]/collaborations
 * Add company collaboration to category (god/super_admin only)
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	// Check permissions: god or super_admin
	if (!(await isGod(locals.user.id)) && !(await isSuperAdmin(locals.user.id))) {
		return json({ message: 'Unauthorized' }, { status: 403 });
	}

	const { companyId, canCreateProjects, canViewProjects, canManageProjects } = await request.json();

	if (!companyId) {
		return json({ message: 'companyId is required' }, { status: 400 });
	}

	try {
		const collaboration = await addCategoryCollaboration(params.id, companyId, {
			canCreateProjects,
			canViewProjects,
			canManageProjects
		});
		return json({ data: collaboration }, { status: 201 });
	} catch (error: any) {
		return json({ message: 'Failed to add collaboration' }, { status: 500 });
	}
};

/**
 * DELETE /api/project-categories/[id]/collaborations/[companyId]
 * Remove company collaboration from category (god/super_admin only)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	// Check permissions: god or super_admin
	if (!(await isGod(locals.user.id)) && !(await isSuperAdmin(locals.user.id))) {
		return json({ message: 'Unauthorized' }, { status: 403 });
	}

	await removeCategoryCollaboration(params.id, params.companyId);
	return json({ message: 'Collaboration removed successfully' });
};
