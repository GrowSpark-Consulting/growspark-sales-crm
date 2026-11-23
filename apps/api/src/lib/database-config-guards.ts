/**
 * Pure, side-effect-free checks on database configuration, shared between
 * src/env.ts (the main API server's startup validation) and the staging
 * scripts (package 4C, Part C) that load apps/api/.env.staging.local
 * themselves and never go through env.ts at all. Returning a message string
 * (or null when there is nothing to report) keeps these independently
 * testable without needing to simulate process.exit.
 */

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * DATABASE_URL's `?schema=` query param decides where `prisma migrate`
 * applies its SQL and where `_prisma_migrations` lands; DATABASE_SCHEMA
 * decides what apps/api/src/db/prisma.ts passes to the adapter-pg driver
 * for every runtime query (see docs/decisions.md D58 — the adapter's own
 * `schema` option, not Prisma's multiSchema, is what actually makes the
 * Client target a non-public schema). If these two ever disagree, migrations
 * and the running app would silently read and write different schemas.
 */
export function checkDatabaseSchemaConsistency(
  databaseUrl: string,
  databaseSchema: string | undefined,
): string | null {
  let urlSchema: string | undefined;
  try {
    urlSchema = new URL(databaseUrl).searchParams.get('schema') ?? undefined;
  } catch {
    // An unparsable DATABASE_URL is reported by its own "is this a valid
    // connection string" validation elsewhere; this check has nothing
    // meaningful to compare, so it stays silent rather than piling on.
    return null;
  }

  if (!urlSchema && !databaseSchema) {
    return null;
  }
  if (urlSchema === databaseSchema) {
    return null;
  }

  return (
    `DATABASE_URL's ?schema= query param (${urlSchema ?? 'unset'}) and ` +
    `DATABASE_SCHEMA (${databaseSchema ?? 'unset'}) must match.`
  );
}

/**
 * Local dev and test must never point at anything but a local database —
 * accidentally running `pnpm dev` or `pnpm test` against Supabase would be
 * both dangerous (shared staging data) and silently wrong (DATABASE_SCHEMA
 * targeting a schema the local Docker Postgres doesn't have). This is
 * intentionally never called for NODE_ENV=production (Render genuinely
 * connects to Supabase) or from the staging scripts (which load
 * .env.staging.local directly and never import this guard).
 */
export function checkLocalDatabaseHost(databaseUrl: string): string | null {
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    return null;
  }

  if (LOCAL_DATABASE_HOSTS.has(host)) {
    return null;
  }

  return (
    `DATABASE_URL points at host "${host}", not localhost. Local development ` +
    `and tests must use the Docker Postgres on 127.0.0.1 — refusing to start ` +
    `rather than risk running against a remote database by accident.`
  );
}
