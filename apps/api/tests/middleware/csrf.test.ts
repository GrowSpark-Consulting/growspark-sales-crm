import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { enforceOriginAndContentType } from '../../src/middleware/csrf.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { requestId } from '../../src/middleware/request-id.js';
import { ALLOWED_ORIGIN } from '../helpers/http.js';

function buildApp() {
  const app = express();
  app.use(requestId);
  app.use(enforceOriginAndContentType);
  app.use(express.json());
  app.get('/x', (_req, res) => res.json({ ok: true }));
  app.post('/x', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

/**
 * A stub, never a real attachApiKeyContext — this file tests enforceOriginAndContentType's
 * own exemption logic in isolation (req.apiKeyCtx already set), independent of how it got
 * set. The real middleware ordering (attachApiKeyContext rejecting a missing/invalid key with
 * 401 before this code ever runs) is proven end-to-end against the real intake route instead.
 */
function buildAppWithApiKeyCtx() {
  const app = express();
  app.use(requestId);
  app.use((req, _res, next) => {
    req.apiKeyCtx = { organizationId: 'org-1', apiKeyId: 'key-1', keyPrefix: 'gsk_live_test' };
    next();
  });
  app.use(enforceOriginAndContentType);
  app.use(express.json());
  app.post('/x', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('enforceOriginAndContentType', () => {
  it('never blocks a GET request regardless of Origin', async () => {
    const res = await request(buildApp()).get('/x');
    expect(res.status).toBe(200);
  });

  it('allows a POST from an allowed Origin with a JSON content type', async () => {
    const res = await request(buildApp())
      .post('/x')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(200);
  });

  it('rejects a POST with no Origin header at all', async () => {
    const res = await request(buildApp())
      .post('/x')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a POST from a disallowed Origin', async () => {
    const res = await request(buildApp())
      .post('/x')
      .set('Origin', 'https://evil.example')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(403);
  });

  it('allows a bodyless POST from an allowed Origin with no Content-Type header at all', async () => {
    const res = await request(buildApp()).post('/x').set('Origin', ALLOWED_ORIGIN);
    expect(res.status).toBe(200);
  });

  it('rejects a POST with a non-JSON Content-Type', async () => {
    const res = await request(buildApp())
      .post('/x')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'text/plain')
      .send('hello');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('D71: with req.apiKeyCtx already set, a POST with no Origin header at all still succeeds', async () => {
    const res = await request(buildAppWithApiKeyCtx())
      .post('/x')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(200);
  });

  it('D71: with req.apiKeyCtx already set, the Content-Type check still applies (415)', async () => {
    const res = await request(buildAppWithApiKeyCtx())
      .post('/x')
      .set('Content-Type', 'text/plain')
      .send('hello');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
