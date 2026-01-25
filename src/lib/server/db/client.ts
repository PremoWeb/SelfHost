import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import * as gitSchema from './git-schema';

const DATABASE_URL = process.env.DATABASE_URL || 'file:sqlite.db';

// Create client
export const client = createClient({
	url: DATABASE_URL,
	authToken: process.env.DATABASE_AUTH_TOKEN
});

// Create drizzle instance with both schemas
export const db = drizzle(client, { schema: { ...schema, ...gitSchema } });
