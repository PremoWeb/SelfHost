import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth } from '$lib/server/auth/permissions';
import { isGod, isCompanyAdmin } from '$lib/server/auth/permissions';
import {
	shareResource,
	getSharedResources,
	getOwnedResourceShares,
	removeResourceShare
} from '$lib/server/services/resource-sharing';
import type { ResourceType } from '$lib/server/services/resource-sharing';

/**
 * GET /api/resource-shares
 * List resource shares (incoming or outgoing based on query params)
 */
export const GET: RequestHandler = async (event) => {
	const { locals, url } = event;
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const type = url.searchParams.get('type'); // 'incoming' or 'outgoing'
	const companyId = url.searchParams.get('companyId');
	const status = url.searchParams.get('status') as 'pending' | 'approved' | 'rejected' | undefined;

	if (!companyId) {
		return json({ message: 'companyId is required' }, { status: 400 });
	}

	// Check permissions: god or company admin
	if (!(await isGod(locals.user.id))) {
		if (!(await isCompanyAdmin(locals.user.id, companyId))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	if (type === 'incoming') {
		const shares = await getSharedResources(companyId, status);
		return json({ data: shares });
	} else {
		const shares = await getOwnedResourceShares(companyId, status);
		return json({ data: shares });
	}
};

/**
 * POST /api/resource-shares
 * Request resource share
 */
export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;
	await requireApiAuth(locals);

	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const { resourceType, resourceId, ownerCompanyId, sharedWithCompanyId, permissions } = await request.json();

	if (!resourceType || !resourceId || !ownerCompanyId || !sharedWithCompanyId || !permissions) {
		return json({ message: 'Missing required fields' }, { status: 400 });
	}

	// Check permissions: god or company admin of owner company
	if (!(await isGod(locals.user.id))) {
		if (!(await isCompanyAdmin(locals.user.id, ownerCompanyId))) {
			return json({ message: 'Unauthorized' }, { status: 403 });
		}
	}

	try {
		const share = await shareResource(
			resourceType as ResourceType,
			resourceId,
			ownerCompanyId,
			sharedWithCompanyId,
			permissions
		);
		return json({ data: share }, { status: 201 });
	} catch (error: any) {
		return json({ message: 'Failed to create resource share' }, { status: 500 });
	}
};
