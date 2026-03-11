import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 10, idle_timeout: 30 });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
