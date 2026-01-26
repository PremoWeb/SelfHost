import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as loggingSchema from './logging-schema';

import { env } from '$env/dynamic/private';

const LOGGING_DATABASE_URL = env.LOGGING_DATABASE_URL || 'file:sqlite-logs.db';

// Create logging database client
export const loggingClient = createClient({
	url: LOGGING_DATABASE_URL,
	authToken: env.LOGGING_DATABASE_AUTH_TOKEN
});

// Create drizzle instance for logging
export const loggingDb = drizzle(loggingClient, { schema: loggingSchema });
