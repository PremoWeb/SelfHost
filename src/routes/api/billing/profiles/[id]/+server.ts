import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth } from '$lib/server/auth/permissions';
import { isGod, isCompanyAdmin } from '$lib/server/auth/permissions';
import {
	getBillingProfile,
	updateBillingProfile,
	deleteBillingProfile
} from '$lib/server/services/billing';

/**
 * GET /api/billing/profiles/[id]
 * Get billing profile
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const profile = await getBillingProfile(params.id);

	if (!profile) {
		return json({ message: 'Billing profile not found' }, { status: 404 });
	}

	// Check permissions: god or company admin
	if (!(await isGod(locals.user.id))) {
		if (profile.companyId && !(await isCompanyAdmin(locals.user.id, profile.companyId))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	return json({ data: profile });
};

/**
 * PATCH /api/billing/profiles/[id]
 * Update billing profile
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const profile = await getBillingProfile(params.id);

	if (!profile) {
		return json({ message: 'Billing profile not found' }, { status: 404 });
	}

	// Check permissions: god or company admin
	if (!(await isGod(locals.user.id))) {
		if (profile.companyId && !(await isCompanyAdmin(locals.user.id, profile.companyId))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	const { name, billingEmail, billingAddress, paymentMethod, settings } = await request.json();

	try {
		const updated = await updateBillingProfile(params.id, {
			name,
			billingEmail,
			billingAddress,
			paymentMethod,
			settings
		});
		return json({ data: updated });
	} catch (error: any) {
		return json({ message: 'Failed to update billing profile' }, { status: 500 });
	}
};

/**
 * DELETE /api/billing/profiles/[id]
 * Delete billing profile
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const profile = await getBillingProfile(params.id);

	if (!profile) {
		return json({ message: 'Billing profile not found' }, { status: 404 });
	}

	// Check permissions: god or company admin
	if (!(await isGod(locals.user.id))) {
		if (profile.companyId && !(await isCompanyAdmin(locals.user.id, profile.companyId))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	await deleteBillingProfile(params.id);
	return json({ message: 'Billing profile deleted successfully' });
};
