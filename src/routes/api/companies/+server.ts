import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth } from '$lib/server/auth/permissions';
import { isGod, isCompanyOwner, isCompanyAdmin } from '$lib/server/auth/permissions';
import {
	createCompany,
	getCompaniesForUser,
	getAllCompanies
} from '$lib/server/services/companies';

/**
 * GET /api/companies
 * List companies user has access to (or all companies if god)
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	// God can see all companies
	if (await isGod(locals.user.id)) {
		const companies = await getAllCompanies();
		return json({ data: companies });
	}

	// Regular users see only their companies
	const companies = await getCompaniesForUser(locals.user.id);
	return json({ data: companies });
};

/**
 * POST /api/companies
 * Create a new company (user becomes owner)
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const { name, description, slug } = await request.json();

	if (!name) {
		return json({ message: 'Name is required' }, { status: 400 });
	}

	try {
		const company = await createCompany(locals.user.id, { name, description, slug });
		return json({ data: company }, { status: 201 });
	} catch (error: any) {
		if (error.message?.includes('UNIQUE constraint')) {
			return json({ message: 'Company slug already exists' }, { status: 400 });
		}
		return json({ message: 'Failed to create company' }, { status: 500 });
	}
};
