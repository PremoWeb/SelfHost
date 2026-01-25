import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireAuth, isGod } from '$lib/server/auth/permissions';
import { queryActionLogs } from '$lib/server/services/action-logger';
import { initializeLoggingDatabase } from '$lib/server/db/init-logging';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requireAuth(locals);

	// Only God users can view logs
	if (!locals.user || !(await isGod(locals.user.id))) {
		throw error(403, 'Unauthorized: Only God users can view action logs');
	}

	// Ensure logging database is initialized before querying
	await initializeLoggingDatabase();

	// Parse query parameters
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100); // Max 100 per page
	const offset = (page - 1) * limit;

	const userId = url.searchParams.get('userId') || undefined;
	const action = url.searchParams.get('action') || undefined;
	const resourceType = url.searchParams.get('resourceType') || undefined;
	const resourceId = url.searchParams.get('resourceId') || undefined;
	const teamId = url.searchParams.get('teamId') || undefined;
	const companyId = url.searchParams.get('companyId') || undefined;
	const impersonatedBy = url.searchParams.get('impersonatedBy') || undefined;
	const success = url.searchParams.get('success');
	const successFilter = success !== null ? success === 'true' : undefined;

	// Date filters
	const startDate = url.searchParams.get('startDate');
	const endDate = url.searchParams.get('endDate');
	const startDateObj = startDate ? new Date(startDate) : undefined;
	const endDateObj = endDate ? new Date(endDate) : undefined;

	// Build query options
	const queryOptions = {
		userId,
		action,
		resourceType,
		resourceId,
		teamId,
		companyId,
		impersonatedBy,
		startDate: startDateObj,
		endDate: endDateObj,
		limit,
		offset
	};

	// Fetch logs
	const logs = await queryActionLogs(queryOptions);

	// Get total count (we'll need to add a count function, but for now we'll estimate)
	// For a proper implementation, we'd want a separate count query
	const hasMore = logs.length === limit;

	// Filter by success if specified (since queryActionLogs doesn't support it yet)
	const filteredLogs = successFilter !== undefined
		? logs.filter(log => log.success === successFilter)
		: logs;

	return {
		logs: filteredLogs,
		pagination: {
			page,
			limit,
			hasMore,
			total: filteredLogs.length // This is approximate
		},
		filters: {
			userId,
			action,
			resourceType,
			resourceId,
			teamId,
			companyId,
			impersonatedBy,
			success: successFilter,
			startDate,
			endDate
		}
	};
};
