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
});
