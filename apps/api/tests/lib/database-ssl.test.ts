import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveDatabaseSsl } from '../../src/lib/database-ssl.js';

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
