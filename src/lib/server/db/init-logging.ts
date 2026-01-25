import { loggingClient } from './logging-client';
import { sql } from 'drizzle-orm';
import { building } from '$app/environment';

/**
 * Initialize the logging database by creating the action_logs table
 * This is a separate database from the main application database
 */
let loggingInitPromise: Promise<void> | null = null;
let isLoggingInitialized = false;

export async function initializeLoggingDatabase(): Promise<void> {
	// Skip during build
	if (building) {
		return;
	}

	// If already initialized, return immediately
	if (isLoggingInitialized) {
		return;
	}

	// If initialization is in progress, wait for it
	if (loggingInitPromise) {
		return loggingInitPromise;
	}

	// Start initialization
	loggingInitPromise = (async () => {
		try {
			// Quick connectivity check
			await loggingClient.execute('SELECT 1');

			// Check if action_logs table exists
			const tableExists = await checkLoggingTable();

			if (!tableExists) {
				await createLoggingTable();
			}

			// Create indexes
			await createLoggingIndexes();

			isLoggingInitialized = true;
		} catch (error) {
			// Don't throw - logging failures shouldn't break the app
		}
	})();

	return loggingInitPromise;
}

async function checkLoggingTable(): Promise<boolean> {
	try {
		const result = await loggingClient.execute({
			sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='action_logs'",
			args: []
		});
		return result.rows.length > 0;
	} catch (error) {
		return false;
	}
}

async function createLoggingTable(): Promise<void> {
	await loggingClient.execute({
		sql: `
			CREATE TABLE IF NOT EXISTS action_logs (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				user_email TEXT,
				user_name TEXT,
				impersonated_by TEXT,
				impersonation_type TEXT,
				impersonation_entity_id TEXT,
				action TEXT NOT NULL,
				resource_type TEXT,
				resource_id TEXT,
				method TEXT NOT NULL,
				path TEXT NOT NULL,
				ip_address TEXT,
				user_agent TEXT,
				team_id TEXT,
				company_id TEXT,
				metadata TEXT DEFAULT '{}',
				request_body TEXT,
				success INTEGER NOT NULL DEFAULT 1,
				error_message TEXT,
				created_at INTEGER NOT NULL DEFAULT (unixepoch())
			)
		`,
		args: []
	});
}

async function createLoggingIndexes(): Promise<void> {
	const indexes = [
		{ name: 'idx_action_logs_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id)' },
		{ name: 'idx_action_logs_action', sql: 'CREATE INDEX IF NOT EXISTS idx_action_logs_action ON action_logs(action)' },
		{ name: 'idx_action_logs_resource_type', sql: 'CREATE INDEX IF NOT EXISTS idx_action_logs_resource_type ON action_logs(resource_type)' },
		{ name: 'idx_action_logs_resource_id', sql: 'CREATE INDEX IF NOT EXISTS idx_action_logs_resource_id ON action_logs(resource_id)' },
		{ name: 'idx_action_logs_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs(created_at)' },
		{ name: 'idx_action_logs_team_id', sql: 'CREATE INDEX IF NOT EXISTS idx_action_logs_team_id ON action_logs(team_id)' },
		{ name: 'idx_action_logs_company_id', sql: 'CREATE INDEX IF NOT EXISTS idx_action_logs_company_id ON action_logs(company_id)' },
		{ name: 'idx_action_logs_impersonated_by', sql: 'CREATE INDEX IF NOT EXISTS idx_action_logs_impersonated_by ON action_logs(impersonated_by)' }
	];

	for (const index of indexes) {
		try {
			await loggingClient.execute({ sql: index.sql, args: [] });
		} catch (error: any) {
			// Silently fail if index already exists or creation fails
		}
	}
}
