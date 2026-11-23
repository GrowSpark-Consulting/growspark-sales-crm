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
