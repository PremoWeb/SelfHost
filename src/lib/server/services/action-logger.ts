import { loggingDb } from '../db/logging-client';
import { actionLogs } from '../db/logging-schema';
import type { RequestEvent } from '@sveltejs/kit';

export interface LogActionOptions {
	action: string;
	resourceType?: string;
	resourceId?: string;
	method?: string;
	path?: string;
	metadata?: Record<string, any>;
	requestBody?: Record<string, any>;
	success?: boolean;
	errorMessage?: string;
}

/**
 * Log an action taken in the UI
 * This should be called from actions, API routes, and remote functions
 */
export async function logAction(
	locals: App.Locals,
	event: RequestEvent,
	options: LogActionOptions
): Promise<void> {
	try {
		// Don't log if no user is present
		if (!locals.user) {
			return;
		}

		// Extract request information
		const ipAddress = event.getClientAddress();
		const userAgent = event.request.headers.get('user-agent') || undefined;
		const method = options.method || event.request.method;
		const path = options.path || event.url.pathname;

		// Extract impersonation context
		const impersonatedBy = locals.impersonatedBy?.id || null;
		const impersonationType = locals.impersonationType || null;
		const impersonationEntityId = locals.impersonationEntity?.id || null;

		// Sanitize request body to remove sensitive data
		const sanitizedBody = sanitizeRequestBody(options.requestBody);

		// Insert log entry
		await loggingDb.insert(actionLogs).values({
			userId: locals.user.id,
			userEmail: locals.user.email,
			userName: locals.user.name,
			impersonatedBy: impersonatedBy || undefined,
			impersonationType: impersonationType || undefined,
			impersonationEntityId: impersonationEntityId || undefined,
			action: options.action,
			resourceType: options.resourceType,
			resourceId: options.resourceId,
			method,
			path,
			ipAddress,
			userAgent,
			teamId: locals.team?.id || undefined,
			companyId: locals.activeCompanyId || undefined,
			metadata: options.metadata || {},
			requestBody: sanitizedBody,
			success: options.success ?? true,
			errorMessage: options.errorMessage
		});
	} catch (error) {
		// Don't throw - logging failures shouldn't break the application
		// Silently fail
	}
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeRequestBody(body: Record<string, any> | undefined): Record<string, any> | undefined {
	if (!body) return undefined;

	const sensitiveKeys = [
		'password',
		'secret',
		'token',
		'apiKey',
		'accessToken',
		'refreshToken',
		'privateKey',
		'sshKey',
		'credential'
	];

	const sanitized: Record<string, any> = {};

	for (const [key, value] of Object.entries(body)) {
		const lowerKey = key.toLowerCase();
		if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
			sanitized[key] = '[REDACTED]';
		} else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			sanitized[key] = sanitizeRequestBody(value as Record<string, any>);
		} else {
			sanitized[key] = value;
		}
	}

	return sanitized;
}

/**
 * Helper to log actions from SvelteKit actions
 */
export async function logActionFromForm(
	locals: App.Locals,
	event: RequestEvent,
	action: string,
	options?: Partial<LogActionOptions>,
    existingFormData?: FormData
): Promise<void> {
    let formData: FormData;
    try {
        formData = existingFormData || await event.request.formData();
    } catch (e) {
        // If body is already consumed and no formData provided, we can't log the body
        // Just log the action without body
        await logAction(locals, event, {
            action,
            method: 'POST',
            requestBody: {},
            ...options
        });
        return;
    }

	const body: Record<string, any> = {};
	
	// Convert FormData to object (for logging)
	for (const [key, value] of formData.entries()) {
		body[key] = value.toString();
	}

	await logAction(locals, event, {
		action,
		method: 'POST',
		requestBody: body,
		...options
	});
}

/**
 * Helper to log actions from API routes
 */
export async function logActionFromApi(
	locals: App.Locals,
	event: Pick<RequestEvent, 'request' | 'url' | 'getClientAddress'>,
	action: string,
	options?: Partial<LogActionOptions>
): Promise<void> {
	try {
		let requestBody: Record<string, any> | undefined;
		
		try {
			if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
				const contentType = event.request.headers.get('content-type') || '';
				if (contentType.includes('application/json')) {
					// Clone request to avoid consuming the body
					const clonedRequest = event.request.clone();
					requestBody = await clonedRequest.json();
				}
			}
		} catch (error) {
			// Ignore JSON parsing errors
		}

		await logAction(locals, event as RequestEvent, {
			action,
			requestBody,
			...options
		});
	} catch (error) {
		// Don't throw - logging failures shouldn't break the application
		// Silently fail
	}
}

/**
 * Query action logs
 */
export interface QueryLogsOptions {
	userId?: string;
	action?: string;
	resourceType?: string;
	resourceId?: string;
	teamId?: string;
	companyId?: string;
	impersonatedBy?: string;
	startDate?: Date;
	endDate?: Date;
	limit?: number;
	offset?: number;
}

export async function queryActionLogs(options: QueryLogsOptions = {}) {
	// Ensure database is initialized before querying
	const { initializeLoggingDatabase } = await import('../db/init-logging');
	await initializeLoggingDatabase();

	const { eq, and, gte, lte, desc } = await import('drizzle-orm');
	
	const conditions = [];
	
	if (options.userId) {
		conditions.push(eq(actionLogs.userId, options.userId));
	}
	if (options.action) {
		conditions.push(eq(actionLogs.action, options.action));
	}
	if (options.resourceType) {
		conditions.push(eq(actionLogs.resourceType, options.resourceType));
	}
	if (options.resourceId) {
		conditions.push(eq(actionLogs.resourceId, options.resourceId));
	}
	if (options.teamId) {
		conditions.push(eq(actionLogs.teamId, options.teamId));
	}
	if (options.companyId) {
		conditions.push(eq(actionLogs.companyId, options.companyId));
	}
	if (options.impersonatedBy) {
		conditions.push(eq(actionLogs.impersonatedBy, options.impersonatedBy));
	}
	if (options.startDate) {
		// Convert Date to Unix timestamp (seconds) - createdAt is stored as Unix timestamp integer
		// Drizzle's timestamp mode expects Date objects, but we need to compare as integers
		const timestamp = Math.floor(options.startDate.getTime() / 1000);
		const { sql } = await import('drizzle-orm');
		conditions.push(sql`${actionLogs.createdAt} >= ${timestamp}`);
	}
	if (options.endDate) {
		// Convert Date to Unix timestamp (seconds) - createdAt is stored as Unix timestamp integer
		const timestamp = Math.floor(options.endDate.getTime() / 1000);
		const { sql } = await import('drizzle-orm');
		conditions.push(sql`${actionLogs.createdAt} <= ${timestamp}`);
	}

	try {
		const query = loggingDb
			.select()
			.from(actionLogs)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(actionLogs.createdAt))
			.limit(options.limit || 100)
			.offset(options.offset || 0);

		return await query;
	} catch (error: any) {
		// If table doesn't exist, return empty array
		if (error?.message?.includes('no such table') || error?.message?.includes('action_logs')) {
			return [];
		}
		throw error;
	}
}
