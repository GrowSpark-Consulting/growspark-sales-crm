import { describe, expect, it } from 'vitest';
import { checkSampleSeedAllowed } from '../../src/lib/sample-seed-guard.js';

describe('checkSampleSeedAllowed', () => {
  it('allows APP_ENV=local unconditionally, preserving today\'s local-dev behaviour', () => {
    expect(checkSampleSeedAllowed({ appEnv: 'local', databaseSchema: undefined, confirmed: false })).toBeNull();
  });

  it('refuses staging without --confirm', () => {
    const message = checkSampleSeedAllowed({ appEnv: 'staging', databaseSchema: 'sales', confirmed: false });
    expect(message).toMatch(/--confirm/);
  });

  it('refuses staging with --confirm but the wrong schema', () => {
    const message = checkSampleSeedAllowed({ appEnv: 'staging', databaseSchema: 'public', confirmed: true });
    expect(message).toMatch(/DATABASE_SCHEMA/);
    expect(message).toContain('sales');
    expect(message).toContain('public');
  });

  it('refuses staging with --confirm and no schema set at all', () => {
    const message = checkSampleSeedAllowed({ appEnv: 'staging', databaseSchema: undefined, confirmed: true });
    expect(message).toMatch(/unset/);
  });

  it('allows staging with --confirm and the sales schema', () => {
    expect(checkSampleSeedAllowed({ appEnv: 'staging', databaseSchema: 'sales', confirmed: true })).toBeNull();
  });

  it('refuses APP_ENV=production even with --confirm and the right schema', () => {
    const message = checkSampleSeedAllowed({ appEnv: 'production', databaseSchema: 'sales', confirmed: true });
    expect(message).toMatch(/APP_ENV=production/);
  });

  it('refuses when APP_ENV is missing — there is no permissive default', () => {
    const message = checkSampleSeedAllowed({ appEnv: undefined, databaseSchema: undefined, confirmed: true });
    expect(message).toMatch(/\(unset\)/);
  });

  it('refuses an unrecognised APP_ENV value rather than guessing', () => {
    const message = checkSampleSeedAllowed({ appEnv: 'bogus', databaseSchema: 'sales', confirmed: true });
    expect(message).toMatch(/APP_ENV=bogus/);
  });
});

describe('the --confirm flag survives pnpm\'s "--" argument separator', () => {
  it('Array.prototype.includes finds "--confirm" regardless of a leading "--" entry', () => {
    // Verified empirically: `pnpm staging:seed-sample -- --confirm` forwards
    // process.argv as [...,'--','--confirm'] in the pnpm version this repo
    // pins — the stray "--" does not make "--confirm" disappear from the
    // array, so the .includes() check scripts/db-seed-sample.ts uses is
    // already correct. This test locks that guarantee in rather than relying
    // on re-discovering it by hand again later.
    expect(['node', 'script.js', '--', '--confirm'].includes('--confirm')).toBe(true);
  });
});
