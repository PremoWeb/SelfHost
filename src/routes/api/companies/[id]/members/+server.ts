import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth } from '$lib/server/auth/permissions';
import { isGod, isCompanyAdmin } from '$lib/server/auth/permissions';
import {
	getCompanyById,
	getCompanyMembers,
	addCompanyMember,
	removeCompanyMember
} from '$lib/server/services/companies';

/**
 * GET /api/companies/[id]/members
 * Get company members
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
		const isMember = company.members?.some((m) => m.userId === locals.user!.id);
		if (!isMember) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	const members = await getCompanyMembers(params.id);
	return json({ data: members });
};

/**
 * POST /api/companies/[id]/members
 * Add a member to the company (admin/owner only)
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const company = await getCompanyById(params.id);

	if (!company) {
		return json({ message: 'Company not found' }, { status: 404 });
	}

	// Check permissions: god or company admin
	if (!(await isGod(locals.user.id))) {
		if (!(await isCompanyAdmin(locals.user.id, company.id))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	const { userId, role } = await request.json();

	if (!userId || !role) {
		return json({ message: 'userId and role are required' }, { status: 400 });
	}

	if (!['owner', 'admin', 'member'].includes(role)) {
		return json({ message: 'Invalid role' }, { status: 400 });
	}

	try {
		const member = await addCompanyMember(params.id, userId, role);
		return json({ data: member }, { status: 201 });
	} catch (error: any) {
		return json({ message: 'Failed to add member' }, { status: 500 });
	}
};

/**
 * DELETE /api/companies/[id]/members/[userId]
 * Remove a member from the company (admin/owner only)
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

	// Check permissions: god or company admin
	if (!(await isGod(locals.user.id))) {
		if (!(await isCompanyAdmin(locals.user.id, company.id))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	await removeCompanyMember(params.id, params.userId);
	return json({ message: 'Member removed successfully' });
};
