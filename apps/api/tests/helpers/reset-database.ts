import { prisma } from '../../src/db/prisma.js';
import { env } from '../../src/env.js';

/**
 * Every application table, snake_case as mapped by `@@map` in schema.prisma.
 * Keep this in sync with the schema — a table added there and not here would
 * silently survive a reset.
 */
const APPLICATION_TABLES = [
  'activities',
  'api_keys',
  'audit_events',
  'companies',
  'contacts',
  'deal_contacts',
  'deal_stage_histories',
  'deals',
  'lead_conversions',
  'lead_sources',
  'lead_status_histories',
  'leads',
  'organizations',
  'pipeline_stages',
  'pipelines',
  'sessions',
  'users',
  'website_submissions',
] as const;

/**
 * Extracts the database name from a connection string and throws unless it
 * ends in `_test`. Exported separately from `resetDatabase` so the guard
 * itself can be unit-tested without ever touching a real connection.
 */
export function assertTestDatabaseName(databaseUrl: string): string {
  const dbName = new URL(databaseUrl).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `resetDatabase() refuses to run against database "${dbName}" — it only runs ` +
        'against a database whose name ends in "_test". Check DATABASE_URL/TEST_DATABASE_URL.',
    );
  }
  return dbName;
}

/**
 * TRUNCATEs every application table (RESTART IDENTITY CASCADE) so a test can
 * start from a known-empty database instead of relying on per-test cleanup.
 * This is destructive and refuses to run unless the connected database name
 * ends in `_test` (see `assertTestDatabaseName`) — it must never be callable
 * against `crm_dev`.
 */
export async function resetDatabase(): Promise<void> {
  assertTestDatabaseName(env.DATABASE_URL);
  const tables = APPLICATION_TABLES.map((table) => `"${table}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
}
