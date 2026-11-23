import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/env.js';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://growspark_dev:growspark_dev_password@127.0.0.1:5433/crm_dev',
};

describe('parseEnv', () => {
  it('accepts a minimal local dev/test configuration', () => {
    const result = parseEnv({ ...BASE_ENV, NODE_ENV: 'test' });
    expect(result.success).toBe(true);
  });

  it('rejects DATABASE_SCHEMA set without a matching ?schema= in DATABASE_URL', () => {
    const result = parseEnv({ ...BASE_ENV, NODE_ENV: 'test', DATABASE_SCHEMA: 'sales' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'DATABASE_SCHEMA');
      expect(issue?.message).toMatch(/must match/);
    }
  });

  it('rejects a ?schema= in DATABASE_URL with no matching DATABASE_SCHEMA', () => {
    const result = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@db.example.supabase.co:5432/postgres?schema=sales',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'DATABASE_SCHEMA');
      expect(issue?.message).toMatch(/must match/);
    }
  });

  it('accepts agreeing DATABASE_URL ?schema= and DATABASE_SCHEMA in production', () => {
    const result = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@db.example.supabase.co:5432/postgres?schema=sales',
      DATABASE_SCHEMA: 'sales',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-local DATABASE_URL host in development', () => {
    const result = parseEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://u:p@db.example.supabase.co:5432/postgres',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'DATABASE_URL');
      expect(issue?.message).toMatch(/localhost/);
    }
  });

  it('rejects a non-local DATABASE_URL host in test', () => {
    const result = parseEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://u:p@db.example.supabase.co:5432/postgres',
    });
    expect(result.success).toBe(false);
  });

  it('does not apply the local-host guard in production (Render genuinely connects to Supabase)', () => {
    const result = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@db.example.supabase.co:5432/postgres?schema=sales',
      DATABASE_SCHEMA: 'sales',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a local DATABASE_URL in development with no DATABASE_SCHEMA set', () => {
    const result = parseEnv({ ...BASE_ENV, NODE_ENV: 'development' });
    expect(result.success).toBe(true);
  });

  it('defaults DATABASE_POOL_MAX to 10 (pg.Pool\'s own default) when unset', () => {
    const result = parseEnv({ ...BASE_ENV, NODE_ENV: 'test' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.DATABASE_POOL_MAX).toBe(10);
  });

  it('accepts a smaller DATABASE_POOL_MAX, e.g. the staging value of 5', () => {
    const result = parseEnv({ ...BASE_ENV, NODE_ENV: 'test', DATABASE_POOL_MAX: '5' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.DATABASE_POOL_MAX).toBe(5);
  });

  it('parses DATABASE_SSL_REJECT_UNAUTHORIZED="false" as the boolean false, not JS-truthy coercion', () => {
    const result = parseEnv({ ...BASE_ENV, NODE_ENV: 'test', DATABASE_SSL_REJECT_UNAUTHORIZED: 'false' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.DATABASE_SSL_REJECT_UNAUTHORIZED).toBe(false);
  });

  it('rejects a DATABASE_SSL_REJECT_UNAUTHORIZED value that is neither "true" nor "false"', () => {
    const result = parseEnv({ ...BASE_ENV, NODE_ENV: 'test', DATABASE_SSL_REJECT_UNAUTHORIZED: 'nope' });
    expect(result.success).toBe(false);
  });
});
