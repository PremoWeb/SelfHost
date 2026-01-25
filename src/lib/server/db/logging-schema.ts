import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Action Logs Table
 * Tracks all actions taken in the UI for audit and debugging purposes
 */
export const actionLogs = sqliteTable('action_logs', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	
	// User information
	userId: text('user_id').notNull(), // The user who performed the action
	userEmail: text('user_email'), // Cached for quick lookups
	userName: text('user_name'), // Cached for quick lookups
	
	// Impersonation context
	impersonatedBy: text('impersonated_by'), // If action was taken while impersonating, this is the God user's ID
	impersonationType: text('impersonation_type'), // 'user' | 'team' | 'company' | null
	impersonationEntityId: text('impersonation_entity_id'), // ID of the entity being impersonated
	
	// Action details
	action: text('action').notNull(), // e.g., 'project.create', 'server.delete', 'user.impersonate'
	resourceType: text('resource_type'), // e.g., 'project', 'server', 'user', 'team'
	resourceId: text('resource_id'), // ID of the resource affected
	
	// Request context
	method: text('method').notNull(), // HTTP method: GET, POST, PUT, DELETE, etc.
	path: text('path').notNull(), // Request path
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	
	// Team/Company context
	teamId: text('team_id'), // Active team context when action was taken
	companyId: text('company_id'), // Active company context when action was taken
	
	// Action data
	metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>().default({}), // Additional context data
	requestBody: text('request_body', { mode: 'json' }).$type<Record<string, any>>(), // Request body (sanitized)
	
	// Result
	success: integer('success', { mode: 'boolean' }).notNull().default(true),
	errorMessage: text('error_message'), // If action failed
	
	// Timestamps
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Indexes for common queries
export const actionLogsIndexes = {
	userId: 'idx_action_logs_user_id',
	action: 'idx_action_logs_action',
	resourceType: 'idx_action_logs_resource_type',
	resourceId: 'idx_action_logs_resource_id',
	createdAt: 'idx_action_logs_created_at',
	teamId: 'idx_action_logs_team_id',
	companyId: 'idx_action_logs_company_id',
	impersonatedBy: 'idx_action_logs_impersonated_by'
};
