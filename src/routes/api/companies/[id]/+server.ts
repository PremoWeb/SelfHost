import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth } from '$lib/server/auth/permissions';
import { isGod, isCompanyOwner, isCompanyAdmin } from '$lib/server/auth/permissions';
import {
	getCompanyById,
	getCompaniesForUser,
	updateCompany,
	deleteCompany
} from '$lib/server/services/companies';

/**
 * GET /api/companies/[id]
 * Get company details
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const company = await getCompanyById(params.id);

	if (!company) {
		return json({ message: 'Company not found' }, { status: 404 });
	}

	// Check access: god or company member
	if (!(await isGod(locals.user.id))) {
		const userCompanies = await getCompaniesForUser(locals.user.id);
		if (!userCompanies.some((c) => c.id === company.id)) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	return json({ data: company });
};

/**
 * PATCH /api/companies/[id]
 * Update company (owner/admin only)
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const company = await getCompanyById(params.id);

	if (!company) {
		return json({ message: 'Company not found' }, { status: 404 });
	}

	// Check permissions: god or company owner/admin
	if (!(await isGod(locals.user.id))) {
		if (!(await isCompanyAdmin(locals.user.id, company.id))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	const { name, description, slug, settings } = await request.json();

	try {
		const updated = await updateCompany(params.id, { name, description, slug, settings });
		return json({ data: updated });
	} catch (error: any) {
		if (error.message?.includes('UNIQUE constraint')) {
			return json({ message: 'Company slug already exists' }, { status: 400 });
		}
		return json({ message: 'Failed to update company' }, { status: 500 });
	}
};

/**
 * DELETE /api/companies/[id]
 * Delete company (god or owner only)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const company = await getCompanyById(params.id);

	if (!company) {
		return json({ message: 'Company not found' }, { status: 404 });
	}

	// Check permissions: god or company owner
	if (!(await isGod(locals.user.id))) {
		if (!(await isCompanyOwner(locals.user.id, company.id))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	await deleteCompany(params.id);
	return json({ message: 'Company deleted successfully' });
};
