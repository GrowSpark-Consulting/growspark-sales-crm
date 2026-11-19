import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateRequest } from '../../src/middleware/validate.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post(
    '/body',
    validateRequest({ body: z.object({ name: z.string().trim().toLowerCase() }) }),
    (req, res) => res.json({ body: req.body }),
  );
  app.get(
    '/query',
    validateRequest({ query: z.object({ page: z.coerce.number().int().positive() }) }),
    (req, res) => res.json({ validatedQuery: req.validatedQuery, rawQuery: req.query }),
  );
  app.get(
    '/params/:id',
    validateRequest({ params: z.object({ id: z.uuid() }) }),
    (req, res) => res.json({ params: req.params }),
  );
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(422).json({ error: { code: 'VALIDATION_FAILED' } });
  });
  return app;
}

describe('validateRequest', () => {
  it('replaces req.body with the parsed (and normalised) value', async () => {
    const res = await request(buildApp()).post('/body').send({ name: '  Foo  ' });
    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ name: 'foo' });
  });

  it('rejects a body that fails the schema', async () => {
    const res = await request(buildApp()).post('/body').send({ name: 123 });
    expect(res.status).toBe(422);
  });

  it('stores a validated query on req.validatedQuery without touching req.query', async () => {
    const res = await request(buildApp()).get('/query?page=3');
    expect(res.status).toBe(200);
    expect(res.body.validatedQuery).toEqual({ page: 3 });
    // req.query itself is untouched (still the raw string) — Express 5 has no setter for it.
    expect(res.body.rawQuery).toEqual({ page: '3' });
  });

  it('rejects a query that fails the schema', async () => {
    const res = await request(buildApp()).get('/query?page=not-a-number');
    expect(res.status).toBe(422);
  });

  it('replaces req.params with the parsed value', async () => {
    const id = '0199a1b2-1234-7890-abcd-ef0123456789';
    const res = await request(buildApp()).get(`/params/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.params).toEqual({ id });
  });

  it('rejects params that fail the schema', async () => {
    const res = await request(buildApp()).get('/params/not-a-uuid');
    expect(res.status).toBe(422);
  });
});
