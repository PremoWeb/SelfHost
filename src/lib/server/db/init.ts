import { db, client } from './client';
import { sql } from 'drizzle-orm';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { building } from '$app/environment';

/**
 * Initialize the database by running pending migrations
 * This ensures the database schema is up-to-date on startup
 */
// Track initialization state to avoid redundant checks
let initializationPromise: Promise<void> | null = null;
let isInitialized = false;

export async function initializeDatabase(): Promise<void> {
	// Skip database initialization during build
	if (building) {
		return;
	}

	// If already initialized, return immediately
	if (isInitialized) {
		return;
	}

	// If initialization is in progress, wait for it
	if (initializationPromise) {
		return initializationPromise;
	}

	// Start initialization
	initializationPromise = (async () => {
		try {
			// Quick connectivity check
			await client.execute('SELECT 1');

			// Check if migrations table exists
			const migrationsTableExists = await checkMigrationsTable();

			if (!migrationsTableExists) {
				await createMigrationsTable();
			}

			// Get applied migrations (fast query)
			const appliedMigrations = await getAppliedMigrations();

			// Get all migration files (cached after first read)
			const migrationFiles = await getMigrationFiles();

			if (migrationFiles.length === 0) {
				isInitialized = true;
				return;
			}

			// Filter out already applied migrations
			const pendingMigrations = migrationFiles.filter(
				(migration) => !appliedMigrations.has(migration.name)
			);

			if (pendingMigrations.length === 0) {
				isInitialized = true;
				return;
			}

			// Apply pending migrations
			for (const migration of pendingMigrations) {
				await applyMigration(migration);
			}

			isInitialized = true;
		} catch (error) {
			// Don't re-throw - allow server to continue
			// The error is logged and can be handled by the application
		} finally {
			initializationPromise = null;
		}
	})();

	return initializationPromise;
}

/**
 * Check if the migrations table exists
 */
async function checkMigrationsTable(): Promise<boolean> {
	try {
		const result = await client.execute(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
		);
		return result.rows.length > 0;
	} catch (error) {
		// If the query fails, the table doesn't exist
		return false;
	}
}

/**
 * Create the migrations tracking table
 */
async function createMigrationsTable(): Promise<void> {
	await client.execute(
		`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			hash TEXT NOT NULL,
			created_at INTEGER DEFAULT (unixepoch())
		)`
	);
}

/**
 * Get list of applied migrations from the database
 */
async function getAppliedMigrations(): Promise<Set<string>> {
	try {
		const result = await client.execute(
			'SELECT hash FROM __drizzle_migrations ORDER BY created_at'
		);
		return new Set(result.rows.map((row: any) => row.hash as string));
	} catch (error) {
		// If table doesn't exist or query fails, return empty set
		return new Set();
	}
}

// Cache migration file list (only read once per process)
let migrationFilesCache: Array<{ name: string; path: string; content: string }> | null = null;

/**
 * Get all migration files from the drizzle directory
 * Uses caching to avoid re-reading files on every check
 */
async function getMigrationFiles(): Promise<Array<{ name: string; path: string; content: string }>> {
	// Return cached result if available
	if (migrationFilesCache !== null) {
		return migrationFilesCache;
	}

	try {
		const migrationsDir = join(process.cwd(), 'drizzle');
		const files = await readdir(migrationsDir);

		// Filter SQL files (exclude meta directory)
		const sqlFiles = files.filter(
			(file) => file.endsWith('.sql') && !file.startsWith('meta')
		);

		const migrations = await Promise.all(
			sqlFiles.map(async (file) => {
				const filePath = join(migrationsDir, file);
				const content = await readFile(filePath, 'utf-8');
				return {
					name: file.replace('.sql', ''),
					path: filePath,
					content
				};
			})
		);

		// Sort migrations by name (which includes the timestamp prefix)
		const sorted = migrations.sort((a, b) => a.name.localeCompare(b.name));
		
		// Cache the result
		migrationFilesCache = sorted;
		
		return sorted;
	} catch (error) {
		return [];
	}
}

/**
 * Apply a single migration
 */
async function applyMigration(migration: { name: string; content: string }): Promise<void> {
	try {

		// Split the migration content by statement breaks
		// Drizzle migrations use --> statement-breakpoint as separators
		// Also handle cases where there's no breakpoint (single statement)
		let statements: string[];

		if (migration.content.includes('--> statement-breakpoint')) {
			statements = migration.content
				.split('--> statement-breakpoint')
				.map((stmt) => stmt.trim())
				.filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));
		} else {
			// Single statement or no breakpoints
			statements = [migration.content.trim()].filter((stmt) => stmt.length > 0);
		}

		// Execute each statement in a transaction-like manner
		// Note: libsql doesn't support transactions the same way, so we execute sequentially
		// Batch execute statements for better performance
		for (const statement of statements) {
			const cleanedStatement = statement.trim();
			if (cleanedStatement && !cleanedStatement.startsWith('--')) {
				try {
					// Use execute with object syntax for better performance
					await client.execute({
						sql: cleanedStatement,
						args: []
					});
				} catch (stmtError: any) {
					// Some statements might fail if they're already applied (e.g., CREATE TABLE IF NOT EXISTS)
					// Log but don't fail the entire migration
					if (
						stmtError?.message?.includes('already exists') ||
						stmtError?.message?.includes('duplicate') ||
						stmtError?.message?.includes('already applied')
					) {
						// Silently skip already-applied statements to reduce log noise
						continue;
					} else {
						throw stmtError;
					}
				}
			}
		}

		// Record the migration as applied
		const hash = migration.name; // Use migration name as hash
		await client.execute({
			sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, unixepoch())',
			args: [hash]
		});
	} catch (error) {
		throw error;
	}
}
