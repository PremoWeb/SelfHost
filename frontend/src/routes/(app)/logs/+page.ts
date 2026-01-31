import type { PageLoad } from './$types';
import { api } from '$lib/api/client';

export const load: PageLoad = async ({ parent, url }) => {
	await parent();

	// Forward URL search params to the API
	const params = new URLSearchParams();
	const filterKeys = [
		'userId',
		'action',
		'resourceType',
		'resourceId',
		'teamId',
		'companyId',
		'impersonatedBy',
		'success',
		'startDate',
		'endDate',
		'page',
		'limit'
	];
	for (const key of filterKeys) {
		const val = url.searchParams.get(key);
		if (val) params.set(key, val);
	}

	const queryString = params.toString();
	const endpoint = queryString ? `/logs?${queryString}` : '/logs';

	// Reconstruct filters from URL params for the UI
	const filters = {
		userId: url.searchParams.get('userId') || undefined,
		action: url.searchParams.get('action') || undefined,
		resourceType: url.searchParams.get('resourceType') || undefined,
		resourceId: url.searchParams.get('resourceId') || undefined,
		teamId: url.searchParams.get('teamId') || undefined,
		companyId: url.searchParams.get('companyId') || undefined,
		impersonatedBy: url.searchParams.get('impersonatedBy') || undefined,
		success: url.searchParams.has('success')
			? url.searchParams.get('success') === 'true'
			: undefined,
		startDate: url.searchParams.get('startDate') || undefined,
		endDate: url.searchParams.get('endDate') || undefined
	};

	try {
		const res = await api.get<{
			data?: any[];
			pagination?: { page: number; hasMore: boolean };
		}>(endpoint);

		const body = res.data;
		const rawLogs = Array.isArray(body?.data) ? body.data : [];

		// Map snake_case to camelCase for the Svelte page component
		const logs = rawLogs.map((l: any) => ({
			...l,
			userId: l.user_id,
			userEmail: l.user_email,
			userName: l.user_name,
			impersonatedBy: l.impersonated_by,
			impersonationType: l.impersonation_type,
			impersonationEntityId: l.impersonation_entity_id,
			resourceType: l.resource_type,
			resourceId: l.resource_id,
			ipAddress: l.ip_address,
			userAgent: l.user_agent,
			teamId: l.team_id,
			companyId: l.company_id,
			requestBody:
				typeof l.request_body === 'string' ? JSON.parse(l.request_body) : (l.request_body ?? {}),
			metadata: typeof l.metadata === 'string' ? JSON.parse(l.metadata) : (l.metadata ?? {}),
			errorMessage: l.error_message,
			createdAt: l.created_at
		}));

		return {
			logs,
			pagination: body?.pagination ?? { page: 1, hasMore: false },
			filters
		};
	} catch {
		return {
			logs: [],
			pagination: { page: 1, hasMore: false },
			filters
		};
	}
};
