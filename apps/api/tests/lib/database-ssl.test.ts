import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildDatabasePoolConfig,
  resolveDatabaseSsl,
  stripPgConnectionStringSslParams,
} from '../../src/lib/database-ssl.js';

const FAKE_PEM = '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----\n';

describe('resolveDatabaseSsl', () => {
  it('returns undefined (unchanged local-dev behaviour) when nothing is set', () => {
    expect(resolveDatabaseSsl({})).toBeUndefined();
  });

  it('is the insecure escape hatch only when explicitly false, and wins over a CA value', () => {
    expect(
      resolveDatabaseSsl({ DATABASE_SSL_REJECT_UNAUTHORIZED: false, DATABASE_SSL_CA: FAKE_PEM }),
    ).toEqual({ rejectUnauthorized: false });
  });

  it('accepts pasted PEM content directly, without touching the filesystem', () => {
    expect(resolveDatabaseSsl({ DATABASE_SSL_CA: FAKE_PEM })).toEqual({
      rejectUnauthorized: true,
      ca: FAKE_PEM,
    });
  });

  describe('with a CA file on disk', () => {
    let dir: string;
    let caPath: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'growspark-ssl-test-'));
      caPath = join(dir, 'ca.pem');
      writeFileSync(caPath, FAKE_PEM, 'utf8');
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('reads a CA file path and returns its contents', () => {
      expect(resolveDatabaseSsl({ DATABASE_SSL_CA: caPath })).toEqual({
        rejectUnauthorized: true,
        ca: FAKE_PEM,
      });
    });

    it('throws a clear error naming the path when the file does not exist', () => {
      const missing = join(dir, 'does-not-exist.pem');
      expect(() => resolveDatabaseSsl({ DATABASE_SSL_CA: missing })).toThrow(missing);
    });
  });
});

describe('stripPgConnectionStringSslParams', () => {
  it('removes sslmode while leaving every other part of the URL untouched', () => {
    const result = stripPgConnectionStringSslParams(
      'postgresql://sales_app.proj:Pass%40word@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?schema=sales&sslmode=verify-full',
    );
    expect(result).toBe('postgresql://sales_app.proj:Pass%40word@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?schema=sales');
  });

  it.each(['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation'])(
    'removes %s regardless of its value',
    (param) => {
      const result = stripPgConnectionStringSslParams(`postgresql://u:p@host:5432/db?schema=sales&${param}=anything`);
      expect(result).not.toContain(param);
      expect(result).toContain('schema=sales');
    },
  );

  it('is a no-op when there is nothing to strip', () => {
    const url = 'postgresql://u:p@host:5432/db?schema=sales';
    expect(stripPgConnectionStringSslParams(url)).toBe(url);
  });

  it('returns the original string unchanged when it cannot be parsed as a URL', () => {
    expect(stripPgConnectionStringSslParams('not-a-url')).toBe('not-a-url');
  });
});

describe('buildDatabasePoolConfig', () => {
  const BASE = { DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/crm_dev', DATABASE_POOL_MAX: 10 };

  it('local dev: no SSL config set, DATABASE_URL passed through unchanged', () => {
    const config = buildDatabasePoolConfig(BASE);
    expect(config).toEqual({
      connectionString: BASE.DATABASE_URL,
      max: 10,
      ssl: undefined,
      connectionTimeoutMillis: 10_000,
    });
  });

  it('always sets a bounded connectionTimeoutMillis, not pg\'s own default of 0 (wait forever)', () => {
    const config = buildDatabasePoolConfig(BASE);
    expect(config.connectionTimeoutMillis).toBeGreaterThan(0);
  });

  it('the bug this fixes: strips sslmode when we also supply an explicit CA, so pg-connection-string cannot discard it', () => {
    const config = buildDatabasePoolConfig({
      DATABASE_URL: 'postgresql://u:p@host:5432/postgres?schema=sales&sslmode=verify-full',
      DATABASE_POOL_MAX: 5,
      DATABASE_SSL_CA: FAKE_PEM,
    });
    expect(config.connectionString).not.toContain('sslmode');
    expect(config.connectionString).toContain('schema=sales');
    expect(config.ssl).toEqual({ rejectUnauthorized: true, ca: FAKE_PEM });
    expect(config.max).toBe(5);
  });

  it('also strips sslmode for the insecure escape hatch, so it is not silently discarded the same way', () => {
    const config = buildDatabasePoolConfig({
      DATABASE_URL: 'postgresql://u:p@host:5432/postgres?schema=sales&sslmode=require',
      DATABASE_POOL_MAX: 5,
      DATABASE_SSL_REJECT_UNAUTHORIZED: false,
    });
    expect(config.connectionString).not.toContain('sslmode');
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('leaves DATABASE_URL untouched when no explicit SSL config applies, even if sslmode is present', () => {
    const url = 'postgresql://u:p@host:5432/postgres?schema=sales&sslmode=verify-full';
    const config = buildDatabasePoolConfig({ DATABASE_URL: url, DATABASE_POOL_MAX: 5 });
    expect(config.connectionString).toBe(url);
    expect(config.ssl).toBeUndefined();
  });
});
