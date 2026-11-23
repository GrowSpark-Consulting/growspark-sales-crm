import { describe, expect, it } from 'vitest';
import {
  checkDatabaseSchemaConsistency,
  checkLocalDatabaseHost,
} from '../../src/lib/database-config-guards.js';

describe('checkDatabaseSchemaConsistency', () => {
  it('is silent when neither the URL nor DATABASE_SCHEMA names a schema', () => {
    expect(checkDatabaseSchemaConsistency('postgresql://u:p@127.0.0.1:5433/crm_dev', undefined)).toBeNull();
  });

  it('is silent when the URL schema and DATABASE_SCHEMA agree', () => {
    expect(
      checkDatabaseSchemaConsistency('postgresql://u:p@db.example.supabase.co:5432/postgres?schema=sales', 'sales'),
    ).toBeNull();
  });

  it('reports a mismatch when DATABASE_SCHEMA is set but the URL has no ?schema=', () => {
    const message = checkDatabaseSchemaConsistency('postgresql://u:p@127.0.0.1:5433/crm_dev', 'sales');
    expect(message).toContain('unset');
    expect(message).toContain('sales');
  });

  it('reports a mismatch when the URL has ?schema= but DATABASE_SCHEMA is unset', () => {
    const message = checkDatabaseSchemaConsistency(
      'postgresql://u:p@db.example.supabase.co:5432/postgres?schema=sales',
      undefined,
    );
    expect(message).toContain('sales');
    expect(message).toContain('unset');
  });

  it('reports a mismatch when the two name different schemas', () => {
    const message = checkDatabaseSchemaConsistency(
      'postgresql://u:p@db.example.supabase.co:5432/postgres?schema=sales',
      'other',
    );
    expect(message).toContain('sales');
    expect(message).toContain('other');
  });

  it('is silent (not its job) when the URL cannot be parsed at all', () => {
    expect(checkDatabaseSchemaConsistency('not-a-url', 'sales')).toBeNull();
  });
});

describe('checkLocalDatabaseHost', () => {
  it.each(['localhost', '127.0.0.1', '::1'])('accepts %s', (host) => {
    expect(checkLocalDatabaseHost(`postgresql://u:p@${host}:5433/crm_dev`)).toBeNull();
  });

  it('rejects a remote host with a message naming the host but not the credentials', () => {
    const message = checkLocalDatabaseHost('postgresql://realuser:realpassword@db.example.supabase.co:5432/postgres');
    expect(message).toContain('db.example.supabase.co');
    expect(message).not.toContain('realuser');
    expect(message).not.toContain('realpassword');
  });

  it('is silent when the URL cannot be parsed at all', () => {
    expect(checkLocalDatabaseHost('not-a-url')).toBeNull();
  });
});
