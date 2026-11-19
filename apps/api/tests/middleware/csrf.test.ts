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
});
