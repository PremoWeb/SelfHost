import 'dotenv/config';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import * as gitSchema from './git-schema';

// Comprehensive environment variable detection
let env: Record<string, string | undefined> = {};

// 1. Start with process.env (Node.js/Bun compatibility)
if (typeof process !== 'undefined' && process.env) {
	env = { ...process.env };
}

// 2. Overlay Bun.env if running in Bun
// @ts-ignore
if (typeof Bun !== 'undefined' && Bun.env) {
	// @ts-ignore
	env = { ...env, ...Bun.env };
}

// No top-level await of dynamic imports to avoid startup hangs during module resolution
if (process.env.DATABASE_URL) {
	env.DATABASE_URL = process.env.DATABASE_URL;
}
if (process.env.DATABASE_AUTH_TOKEN) {
	env.DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN;
}

// @libsql/client expects a URI (e.g. file:///path or http(s)://). Normalize bare paths to file: URI
function normalizeDatabaseUrl(raw: string): string {
	if (!raw) return 'file:sqlite.db';
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw; // already has scheme
	const absolute = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(process.cwd(), raw);
	// file:///absolute/path (three slashes for absolute)
	return 'file:' + (absolute.startsWith('/') ? '//' + absolute : absolute);
}

const DATABASE_URL = normalizeDatabaseUrl(env.DATABASE_URL || 'sqlite.db');
const AUTH_TOKEN = env.DATABASE_AUTH_TOKEN;

// Debug log to help identify connection issues (only in dev)
if (process.env.NODE_ENV === 'development') {
	console.log(`[Database] Connecting to: ${DATABASE_URL}`);
}

// Create client
export const client = createClient({
	url: DATABASE_URL,
	authToken: AUTH_TOKEN
});

// Create drizzle instance with both schemas
export const db = drizzle(client, { schema: { ...schema, ...gitSchema } });
