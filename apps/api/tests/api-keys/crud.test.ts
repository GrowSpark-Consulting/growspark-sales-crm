import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestTenant, createTwoTestTenants } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

function authed(app: ReturnType<typeof createApp>, token: string) {
  const cookie = sessionCookieHeader(token);
  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    post: (path: string, body?: object) =>
      request(app).post(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
  };
}

describe('API keys CRUD (Admin only)', () => {
  it('creates a key (raw key present, shaped distinctly from the list row), lists it without the hash or raw key, then revokes it', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const api = authed(createApp(), token);

    const createRes = await api.post('/api/v1/api-keys', { name: 'Website intake' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.key).toMatch(/^gsk_live_/);
    expect(createRes.body.data.keyPrefix).toMatch(/^gsk_live_/);
    expect(createRes.body.data.revokedAt).toBeNull();
    const apiKeyId = createRes.body.data.id as string;

    const listRes = await api.get('/api/v1/api-keys');
    expect(listRes.status).toBe(200);
    const row = listRes.body.data.find((k: { id: string }) => k.id === apiKeyId);
    expect(row).toBeDefined();
    expect(row.key).toBeUndefined();
    expect(row.keyHash).toBeUndefined();
    expect(row.keyPrefix).toBe(createRes.body.data.keyPrefix);

    const revokeRes = await api.post(`/api/v1/api-keys/${apiKeyId}/revoke`);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.revokedAt).not.toBeNull();
    expect(revokeRes.body.data.key).toBeUndefined();
  });

  it('revoking an already-revoked key returns 409 ALREADY_REVOKED', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const api = authed(createApp(), token);

    const createRes = await api.post('/api/v1/api-keys', { name: 'To revoke twice' });
    const apiKeyId = createRes.body.data.id as string;

    await api.post(`/api/v1/api-keys/${apiKeyId}/revoke`);
    const secondRevoke = await api.post(`/api/v1/api-keys/${apiKeyId}/revoke`);
    expect(secondRevoke.status).toBe(409);
    expect(secondRevoke.body.error.code).toBe('ALREADY_REVOKED');
  });

  it('rotate revokes the old key and returns a new raw key with the same name, in one transaction', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const api = authed(createApp(), token);

    const createRes = await api.post('/api/v1/api-keys', { name: 'Rotating key' });
    const oldApiKeyId = createRes.body.data.id as string;
    const oldKey = createRes.body.data.key as string;

    const rotateRes = await api.post(`/api/v1/api-keys/${oldApiKeyId}/rotate`);
    expect(rotateRes.status).toBe(200);
    expect(rotateRes.body.data.name).toBe('Rotating key');
    expect(rotateRes.body.data.id).not.toBe(oldApiKeyId);
    expect(rotateRes.body.data.key).toMatch(/^gsk_live_/);
    expect(rotateRes.body.data.key).not.toBe(oldKey);

    const listRes = await api.get('/api/v1/api-keys');
    const oldRow = listRes.body.data.find((k: { id: string }) => k.id === oldApiKeyId);
    expect(oldRow.revokedAt).not.toBeNull();
  });

  it('the rotate response carries the raw key exactly once, in a shape distinct from every list row — the frontend bug this guards against', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const api = authed(createApp(), token);

    const createRes = await api.post('/api/v1/api-keys', { name: 'Exactly once' });
    const oldApiKeyId = createRes.body.data.id as string;

    const rotateRes = await api.post(`/api/v1/api-keys/${oldApiKeyId}/rotate`);
    expect(rotateRes.status).toBe(200);
    const newKeyValue = rotateRes.body.data.key as string;
    expect(typeof newKeyValue).toBe('string');
    expect(newKeyValue).toMatch(/^gsk_live_/);
    // "Exactly once" in this single response body — present under data.key,
    // and nowhere else in the same payload (no duplicate top-level field, no
    // echo inside a nested object).
    expect(Object.keys(rotateRes.body.data).filter((key) => rotateRes.body.data[key] === newKeyValue)).toEqual([
      'key',
    ]);
    expect(JSON.stringify(rotateRes.body).split(newKeyValue).length - 1).toBe(1);

    // The list — for BOTH the just-revoked old row and the newly-created
    // row — never carries the raw key or its hash, only keyPrefix. This is
    // the exact guarantee the frontend bug (docs/decisions.md D75) depended
    // on: the UI's only chance to ever see the raw value is this rotate
    // response, never a subsequent list fetch.
    const listRes = await api.get('/api/v1/api-keys');
    const newApiKeyId = rotateRes.body.data.id as string;
    const newRow = listRes.body.data.find((k: { id: string }) => k.id === newApiKeyId);
    const oldRow = listRes.body.data.find((k: { id: string }) => k.id === oldApiKeyId);
    for (const row of [newRow, oldRow]) {
      expect(row).toBeDefined();
      expect(row.key).toBeUndefined();
      expect(row.keyHash).toBeUndefined();
      expect(JSON.stringify(row)).not.toContain(newKeyValue);
    }
  });

  it('Staff receives 403 on every api-keys route', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const api = authed(createApp(), token);
    const placeholderId = '00000000-0000-7000-8000-000000000000';

    expect((await api.get('/api/v1/api-keys')).status).toBe(403);
    expect((await api.post('/api/v1/api-keys', { name: 'x' })).status).toBe(403);
    expect((await api.post(`/api/v1/api-keys/${placeholderId}/revoke`)).status).toBe(403);
    expect((await api.post(`/api/v1/api-keys/${placeholderId}/rotate`)).status).toBe(403);
  });

  it("one organisation's API keys never appear in, or can be acted on by, another's Admin", async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const { token: tokenA } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const { token: tokenB } = await createSession(orgB.organization.id, orgB.adminUser.id);
    const app = createApp();
    const apiA = authed(app, tokenA);
    const apiB = authed(app, tokenB);

    const createRes = await apiA.post('/api/v1/api-keys', { name: 'Org A key' });
    const apiKeyId = createRes.body.data.id as string;

    const listResB = await apiB.get('/api/v1/api-keys');
    expect(listResB.body.data.some((k: { id: string }) => k.id === apiKeyId)).toBe(false);

    const revokeFromB = await apiB.post(`/api/v1/api-keys/${apiKeyId}/revoke`);
    expect(revokeFromB.status).toBe(404);
  });
});
