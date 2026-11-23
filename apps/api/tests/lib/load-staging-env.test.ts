import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkStagingEnv } from '../../scripts/lib/load-staging-env.js';

// A fake, local-only connection string — never a real Supabase value, per
// the project's own rule that this tool never runs a staging script and
// only tests their logic against the local database or a fake file.
const FAKE_LOCAL_URL = 'postgresql://sales_app_sim:sales_app_sim_local_only@127.0.0.1:5433/crm_staging_sim';

describe('checkStagingEnv', () => {
  let dir: string;
  let envVarsToRestore: Record<string, string | undefined>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'growspark-staging-env-test-'));
    envVarsToRestore = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_SCHEMA: process.env.DATABASE_SCHEMA,
    };
    // vitest sets NODE_ENV=test and tests/setup.ts overrides DATABASE_URL to
    // TEST_DATABASE_URL before any test file loads; process.loadEnvFile
    // never overrides an already-set env var (D22/D23) — exactly the
    // behaviour checkStagingEnv relies on in the real script, which starts
    // with none of these preset at all. Clearing them here is what actually
    // lets the fake file's own lines take effect, the same way they would
    // for a real `tsx scripts/staging-migrate.ts` invocation.
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_SCHEMA;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(envVarsToRestore)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function writeFakeEnv(contents: string): string {
    const path = join(dir, '.env.staging.local');
    writeFileSync(path, contents, 'utf8');
    return path;
  }

  it('fails with a clear message naming the path and the .example file when missing', () => {
    const missing = join(dir, 'does-not-exist');
    const result = checkStagingEnv(missing);
    expect(result.ok).toBe(false);
    expect(result.messages.join('\n')).toContain(missing);
    expect(result.messages.join('\n')).toContain('.example');
  });

  it('refuses when NODE_ENV is not exactly "production"', () => {
    const path = writeFakeEnv(`NODE_ENV=development\nDATABASE_URL=${FAKE_LOCAL_URL}?schema=sales\nDATABASE_SCHEMA=sales\n`);
    const result = checkStagingEnv(path);
    expect(result.ok).toBe(false);
    expect(result.messages.join('\n')).toMatch(/NODE_ENV=production/);
  });

  it('refuses when DATABASE_URL and DATABASE_SCHEMA disagree', () => {
    const path = writeFakeEnv(`NODE_ENV=production\nDATABASE_URL=${FAKE_LOCAL_URL}?schema=sales\nDATABASE_SCHEMA=other\n`);
    const result = checkStagingEnv(path);
    expect(result.ok).toBe(false);
    expect(result.messages.join('\n')).toMatch(/must match/);
  });

  it('succeeds and reports only the host and schema, never the password', () => {
    const path = writeFakeEnv(`NODE_ENV=production\nDATABASE_URL=${FAKE_LOCAL_URL}?schema=sales\nDATABASE_SCHEMA=sales\n`);
    const result = checkStagingEnv(path);
    expect(result.ok).toBe(true);
    const joined = result.messages.join('\n');
    expect(joined).toContain('127.0.0.1');
    expect(joined).toContain('sales');
    expect(joined).not.toContain('sales_app_sim_local_only');
  });
});
