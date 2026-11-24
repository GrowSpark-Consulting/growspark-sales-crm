import { readFileSync } from 'node:fs';
import type { PoolConfig } from 'pg';

export interface DatabaseSslEnv {
  DATABASE_SSL_CA?: string | undefined;
  DATABASE_SSL_REJECT_UNAUTHORIZED?: boolean | undefined;
}

/** A CA value starting with the PEM header is literal certificate content; anything else is a file path to read. */
function isPemContent(value: string): boolean {
  return value.trimStart().startsWith('-----BEGIN');
}

/**
 * Unset in local dev (returns undefined — pg relies on whatever sslmode, if
 * any, is already in DATABASE_URL, unchanged from today). In staging,
 * DATABASE_SSL_CA (a file path or pasted PEM content) verifies Supabase's
 * certificate chain properly. DATABASE_SSL_REJECT_UNAUTHORIZED=false is a
 * deliberately insecure escape hatch for only if that verification cannot be
 * made to work — never the default, must be set to exactly "false", and
 * recording *why* it was ever actually needed belongs in
 * docs/decisions.md, not just this comment. See docs/STAGING.md.
 */
export function resolveDatabaseSsl(env: DatabaseSslEnv): PoolConfig['ssl'] {
  if (env.DATABASE_SSL_REJECT_UNAUTHORIZED === false) {
    return { rejectUnauthorized: false };
  }

  if (!env.DATABASE_SSL_CA) {
    return undefined;
  }

  let ca: string;
  try {
    ca = isPemContent(env.DATABASE_SSL_CA) ? env.DATABASE_SSL_CA : readFileSync(env.DATABASE_SSL_CA, 'utf8');
  } catch (err) {
    throw new Error(
      `DATABASE_SSL_CA: could not read CA certificate file "${env.DATABASE_SSL_CA}": ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err },
    );
  }
  return { rejectUnauthorized: true, ca };
}

/**
 * Query params that make `pg-connection-string` discard whatever `ssl`
 * option was passed separately to `new Pool(...)`/`new Client(...)` and
 * rebuild its own from scratch (confirmed by reading its source, v2.14.1,
 * `parseIntoClientConfig`: the mere *presence* of any of these — regardless
 * of value — resets `config.ssl` to `{}` before anything we pass is ever
 * consulted). Supabase's own connection string includes `sslmode=`, so our
 * `DATABASE_SSL_CA`/`DATABASE_SSL_REJECT_UNAUTHORIZED` would otherwise be
 * silently discarded every single time — see docs/decisions.md D68 for how
 * this was actually found (TLS failing even with the exact right CA).
 */
const PG_CONNECTION_STRING_SSL_PARAMS = ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation'];

/**
 * Removes the params above from a Postgres connection string's query
 * string, leaving everything else (host, credentials, `schema`, any other
 * param) untouched. Only call this when we are also passing our own
 * explicit `ssl` option — local dev, with no `DATABASE_SSL_CA`/
 * `DATABASE_SSL_REJECT_UNAUTHORIZED` set, should keep relying on whatever
 * `sslmode` its own `DATABASE_URL` does or doesn't have, unchanged.
 */
export function stripPgConnectionStringSslParams(databaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return databaseUrl; // an unparsable DATABASE_URL is someone else's problem to report
  }
  for (const param of PG_CONNECTION_STRING_SSL_PARAMS) {
    url.searchParams.delete(param);
  }
  return url.toString();
}

export interface DatabasePoolConfigEnv extends DatabaseSslEnv {
  DATABASE_URL: string;
  DATABASE_POOL_MAX: number;
}

/**
 * The one place a `pg.Pool` config is ever built in this app — every caller
 * (the Prisma adapter, the raw pool `src/routes/health.ts` uses for
 * `/health/db`, any future one) goes through this, so there is exactly one
 * connection factory to keep correct, not several that can quietly drift
 * apart (one already had: `src/db/pool.ts`, pre-dating this, built its own
 * `Pool` with neither the pool-size limit nor any SSL config at all — folded
 * into this instead, see docs/decisions.md D68).
 */
/**
 * `pg`'s own default is 0 — no timeout at all, so a connection attempt that
 * never completes (a transient network stall; found for real running this
 * app in Docker for the first time, Day 5 part b: a fresh container's very
 * first connection to the "postgres" Compose service once took over ten
 * minutes before the OS's own TCP retry eventually got through, and every
 * request touching the database hung the whole time because nothing ever
 * gave up) hangs the request indefinitely instead of failing fast. Bounded
 * here so a stalled connection surfaces as a clear, timely error instead.
 */
const CONNECTION_TIMEOUT_MS = 10_000;

export function buildDatabasePoolConfig(env: DatabasePoolConfigEnv): PoolConfig {
  const ssl = resolveDatabaseSsl(env);
  const connectionString = ssl === undefined ? env.DATABASE_URL : stripPgConnectionStringSslParams(env.DATABASE_URL);
  return { connectionString, max: env.DATABASE_POOL_MAX, ssl, connectionTimeoutMillis: CONNECTION_TIMEOUT_MS };
}
