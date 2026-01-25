import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth } from '$lib/server/auth/permissions';
import { isGod, isSuperAdmin } from '$lib/server/auth/permissions';
import {
	getCategoryById,
	updateCategory,
	deleteCategory
} from '$lib/server/services/project-categories';

/**
 * GET /api/project-categories/[id]
 * Get category by ID
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);

	const category = await getCategoryById(params.id);

	if (!category) {
		return json({ message: 'Category not found' }, { status: 404 });
	}

	return json({ data: category });
};

/**
 * PATCH /api/project-categories/[id]
 * Update category (god/super_admin only)
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	// Check permissions: god or super_admin
	if (!(await isGod(locals.user.id)) && !(await isSuperAdmin(locals.user.id))) {
		return json({ message: 'Unauthorized' }, { status: 403 });
	}

	const { name, slug, description, parentId, tags, metadata } = await request.json();

	try {
		const updated = await updateCategory(params.id, {
			name,
			slug,
			description,
			parentId,
			tags,
			metadata
		});
		return json({ data: updated });
	} catch (error: any) {
		return json({ message: 'Failed to update category' }, { status: 500 });
	}
};

/**
 * DELETE /api/project-categories/[id]
 * Delete category (god/super_admin only)
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

	await deleteCategory(params.id);
	return json({ message: 'Category deleted successfully' });
};
