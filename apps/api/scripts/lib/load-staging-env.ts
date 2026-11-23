import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkDatabaseSchemaConsistency } from '../../src/lib/database-config-guards.js';

const STAGING_ENV_FILENAME = '.env.staging.local';

export interface StagingEnvCheckResult {
  ok: boolean;
  /** Printed with console.log on success, console.error on failure. */
  messages: string[];
}

/**
 * The checkable core, separated from the process.exit-on-failure CLI wrapper
 * below so tests can assert on the outcome directly, without a fake failure
 * here killing the test runner — the same split already used for
 * src/env.ts's loadEnv()/parseEnv(). Has the side effect of loading
 * `stagingPath` into process.env via process.loadEnvFile when the file
 * exists, since the checks that follow (NODE_ENV, the schema guard) need it
 * there; existing values still take precedence, per Node's own documented
 * loadEnvFile behaviour (see docs/decisions.md D22/D23).
 */
export function checkStagingEnv(stagingPath: string): StagingEnvCheckResult {
  if (!existsSync(stagingPath)) {
    return {
      ok: false,
      messages: [
        `Staging config not found: ${stagingPath}`,
        `Copy apps/api/${STAGING_ENV_FILENAME}.example to apps/api/${STAGING_ENV_FILENAME} and fill in the real values first.`,
      ],
    };
  }

  process.loadEnvFile(stagingPath);

  if (process.env.NODE_ENV !== 'production') {
    return {
      ok: false,
      messages: [
        `${STAGING_ENV_FILENAME} must set NODE_ENV=production (got "${process.env.NODE_ENV ?? 'unset'}"). ` +
          'Refusing to continue — this is what exempts the local-only database host guard for a script that ' +
          'is supposed to be targeting Supabase, not local Docker Postgres.',
      ],
    };
  }

  // Deliberately duplicates the check src/env.ts's own loadEnv() will also
  // run once imported afterwards (D59) — fails here, before anything has
  // connected to a database at all, with a message naming this file rather
  // than a generic "Invalid environment configuration" dump.
  const schemaMismatch = checkDatabaseSchemaConsistency(process.env.DATABASE_URL ?? '', process.env.DATABASE_SCHEMA);
  if (schemaMismatch) {
    return { ok: false, messages: [`${STAGING_ENV_FILENAME}: ${schemaMismatch}`] };
  }

  return {
    ok: true,
    messages: [
      `Using staging config: ${stagingPath}`,
      `  database host: ${safeHost(process.env.DATABASE_URL)}`,
      `  schema: ${process.env.DATABASE_SCHEMA ?? '(unset)'}`,
    ],
  };
}

function safeHost(databaseUrl: string | undefined): string {
  if (!databaseUrl) return '(DATABASE_URL unset)';
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '(unparsable DATABASE_URL)';
  }
}

/**
 * The real entry point every staging script calls first. Must be called,
 * and must complete, before any dynamic import of ../../src/env.js or
 * ../../src/db/prisma.js — those modules read process.env the instant they
 * are imported, and a static `import` at the top of a staging script would
 * be hoisted above this call.
 */
export function loadStagingEnv(): void {
  const stagingPath = fileURLToPath(new URL(`../../${STAGING_ENV_FILENAME}`, import.meta.url));
  const result = checkStagingEnv(stagingPath);
  for (const message of result.messages) {
    (result.ok ? console.log : console.error)(message);
  }
  if (!result.ok) {
    process.exit(1);
  }
}
