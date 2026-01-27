import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import * as gitSchema from './git-schema';

// Fallback for environment variables when $env is not available (e.g. in Vite config context)
let env: any = process.env;
try {
	const envModule = '$env/dynamic/private';
	// @ts-ignore
	const dynamicPrivate = await import(/* @vite-ignore */ envModule);
	if (dynamicPrivate && dynamicPrivate.env) {
		env = { ...env, ...dynamicPrivate.env };
	}
} catch (e) {
	// $env not available, sticking with process.env
}

const DATABASE_URL = process.env.DATABASE_URL || env.DATABASE_URL || 'file:/data/sqlite.db';

// Create client
export const client = createClient({
	url: DATABASE_URL,
	authToken: process.env.DATABASE_AUTH_TOKEN || env.DATABASE_AUTH_TOKEN
});

// Create drizzle instance with both schemas
export const db = drizzle(client, { schema: { ...schema, ...gitSchema } });
