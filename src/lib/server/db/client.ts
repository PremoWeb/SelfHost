import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import * as gitSchema from './git-schema';

import { env } from '$env/dynamic/private';

const DATABASE_URL = env.DATABASE_URL || 'file:sqlite.db';

// Create client
export const client = createClient({
	url: DATABASE_URL,
	authToken: env.DATABASE_AUTH_TOKEN
});

// Create drizzle instance with both schemas
export const db = drizzle(client, { schema: { ...schema, ...gitSchema } });
