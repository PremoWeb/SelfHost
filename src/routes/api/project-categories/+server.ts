import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth } from '$lib/server/auth/permissions';
import { isGod, isSuperAdmin } from '$lib/server/auth/permissions';
import {
	createCategory,
	getCategoryTree,
	getCategoriesByTags,
	getCategoryById
} from '$lib/server/services/project-categories';

/**
 * GET /api/project-categories
 * Get category tree or filtered by tags
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	await requireApiAuth(locals);

	const tagsParam = url.searchParams.get('tags');
	
	if (tagsParam) {
		const tags = tagsParam.split(',').map((t) => t.trim());
		const categories = await getCategoriesByTags(tags);
		return json({ data: categories });
	}

	const tree = await getCategoryTree();
	return json({ data: tree });
};

/**
 * POST /api/project-categories
 * Create category (god/super_admin only)
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	// Check permissions: god or super_admin
	if (!(await isGod(locals.user.id)) && !(await isSuperAdmin(locals.user.id))) {
		return json({ message: 'Unauthorized' }, { status: 403 });
	}

	const { name, slug, description, parentId, tags, metadata } = await request.json();

	if (!name) {
		return json({ message: 'Name is required' }, { status: 400 });
	}

	try {
		const category = await createCategory({
			name,
			slug,
			description,
			parentId,
			tags,
			metadata
		});
		return json({ data: category }, { status: 201 });
	} catch (error: any) {
		return json({ message: 'Failed to create category' }, { status: 500 });
	}
};
