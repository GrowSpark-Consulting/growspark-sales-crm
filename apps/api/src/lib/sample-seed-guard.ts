/**
 * The "sales" schema this whole staging setup is built around (D58) — not
 * actually configurable anywhere, just named here instead of as a bare
 * string at the one call site that checks it.
 */
const STAGING_SCHEMA_NAME = 'sales';

export interface SampleSeedGuardInput {
  appEnv: string | undefined;
  databaseSchema: string | undefined;
  confirmed: boolean;
}

/**
 * Whether scripts/db-seed-sample.ts may run. `local` is unconditional,
 * preserving `pnpm db:seed:sample`'s existing local-dev behaviour exactly.
 * `staging` additionally needs --confirm AND DATABASE_SCHEMA to actually be
 * "sales" — a second, independent check (on top of the --confirm flag)
 * against pointing a staging-flagged config at the wrong place by accident.
 * `production`, anything unrecognised, or APP_ENV simply not being set at
 * all are always refused — there is no default that resolves "missing" to
 * anything permissive, on purpose (see docs/decisions.md D64).
 *
 * Returns null when allowed, or the refusal message to throw/print.
 */
export function checkSampleSeedAllowed(input: SampleSeedGuardInput): string | null {
  if (input.appEnv === 'local') {
    return null;
  }

  if (input.appEnv === 'staging') {
    if (!input.confirmed) {
      return 'The sample CRM seed refuses to run in staging without --confirm.';
    }
    if (input.databaseSchema !== STAGING_SCHEMA_NAME) {
      return (
        `The sample CRM seed refuses to run in staging: DATABASE_SCHEMA must be ` +
        `"${STAGING_SCHEMA_NAME}" (got "${input.databaseSchema ?? 'unset'}").`
      );
    }
    return null;
  }

  return (
    `The sample CRM seed refuses to run with APP_ENV=${input.appEnv ?? '(unset)'}. ` +
    'Set APP_ENV=local (local dev) or APP_ENV=staging (with --confirm) to run it.'
  );
}
