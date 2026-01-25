import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as loggingSchema from './logging-schema';

const LOGGING_DATABASE_URL = process.env.LOGGING_DATABASE_URL || 'file:sqlite-logs.db';

// Create logging database client
export const loggingClient = createClient({
	url: LOGGING_DATABASE_URL,
	authToken: process.env.LOGGING_DATABASE_AUTH_TOKEN
});

// Create drizzle instance for logging
export const loggingDb = drizzle(loggingClient, { schema: loggingSchema });
