import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth } from '$lib/server/auth/permissions';
import { isGod, isCompanyAdmin } from '$lib/server/auth/permissions';
import {
	createBillingProfile,
	getBillingProfilesForCompany,
	getAllBillingProfiles
} from '$lib/server/services/billing';

/**
 * GET /api/billing/profiles
 * List billing profiles (for a company or all if god)
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const companyId = url.searchParams.get('companyId');

	// God can see all profiles
	if (await isGod(locals.user.id)) {
		const profiles = await getAllBillingProfiles();
		return json({ data: profiles });
	}

	// If companyId provided, check permissions
	if (companyId) {
		if (!(await isCompanyAdmin(locals.user.id, companyId))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
		const profiles = await getBillingProfilesForCompany(companyId);
		return json({ data: profiles });
	}

	// No companyId and not god - return empty
	return json({ data: [] });
};

/**
 * POST /api/billing/profiles
 * Create billing profile
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const { name, companyId, billingEmail, billingAddress, paymentMethod, settings } = await request.json();

	if (!name) {
		return json({ message: 'Name is required' }, { status: 400 });
	}

	// If companyId provided, check permissions
	if (companyId && !(await isGod(locals.user.id))) {
		if (!(await isCompanyAdmin(locals.user.id, companyId))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	try {
		const profile = await createBillingProfile({
			name,
			companyId,
			billingEmail,
			billingAddress,
			paymentMethod,
			settings
		});
		return json({ data: profile }, { status: 201 });
	} catch (error: any) {
		return json({ message: 'Failed to create billing profile' }, { status: 500 });
	}
};
