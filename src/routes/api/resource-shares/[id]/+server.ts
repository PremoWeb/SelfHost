import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth } from '$lib/server/auth/permissions';
import { isGod, isCompanyAdmin } from '$lib/server/auth/permissions';
import {
	approveResourceShare,
	rejectResourceShare,
	removeResourceShare,
	getResourceShares
} from '$lib/server/services/resource-sharing';
import { db } from '$lib/server/db/client';
import { companyResourceShares } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/resource-shares/[id]
 * Get resource share details
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const [share] = await db.select().from(companyResourceShares).where(eq(companyResourceShares.id, params.id)).limit(1);

	if (!share) {
		return json({ message: 'Resource share not found' }, { status: 404 });
	}

	// Check permissions: god or company admin of owner or shared company
	if (!(await isGod(locals.user.id))) {
		const isOwnerAdmin = await isCompanyAdmin(locals.user.id, share.ownerCompanyId);
		const isSharedAdmin = await isCompanyAdmin(locals.user.id, share.sharedWithCompanyId);
		if (!isOwnerAdmin && !isSharedAdmin) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	return json({ data: share });
};

/**
 * PATCH /api/resource-shares/[id]/approve
 * Approve resource share (owner company admin only)
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const [share] = await db.select().from(companyResourceShares).where(eq(companyResourceShares.id, params.id)).limit(1);

	if (!share) {
		return json({ message: 'Resource share not found' }, { status: 404 });
	}

	const action = (await request.json()).action; // 'approve' or 'reject'

	// Check permissions: god or owner company admin
	if (!(await isGod(locals.user.id))) {
		if (!(await isCompanyAdmin(locals.user.id, share.ownerCompanyId))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	try {
		if (action === 'approve') {
			const updated = await approveResourceShare(params.id, locals.user.id);
			return json({ data: updated });
		} else if (action === 'reject') {
			const updated = await rejectResourceShare(params.id);
			return json({ data: updated });
		} else {
			return json({ message: 'Invalid action' }, { status: 400 });
		}
	} catch (error: any) {
		return json({ message: 'Failed to update resource share' }, { status: 500 });
	}
};

/**
 * DELETE /api/resource-shares/[id]
 * Remove resource share (owner company admin only)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const [share] = await db.select().from(companyResourceShares).where(eq(companyResourceShares.id, params.id)).limit(1);

	if (!share) {
		return json({ message: 'Resource share not found' }, { status: 404 });
	}

	// Check permissions: god or owner company admin
	if (!(await isGod(locals.user.id))) {
		if (!(await isCompanyAdmin(locals.user.id, share.ownerCompanyId))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	await removeResourceShare(params.id);
	return json({ message: 'Resource share removed successfully' });
};
