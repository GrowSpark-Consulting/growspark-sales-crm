import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z, ZodError } from 'zod';
import { requestId } from '../../src/middleware/request-id.js';
import { errorHandler, ApiError } from '../../src/middleware/error-handler.js';
import { PRISMA_ERROR } from '../../src/lib/prisma-errors.js';

/** A minimal stand-in for Prisma.PrismaClientKnownRequestError: the central
 * handler only ever checks for `code` and `meta` (see isKnownRequestError),
 * so a plain object with those fields exercises the same branch. */
function fakePrismaError(code: string): Error & { code: string; meta: unknown } {
  const err = new Error(`fake prisma error ${code}`) as Error & { code: string; meta: unknown };
  err.code = code;
  err.meta = {};
  return err;
}

function buildApp() {
  const app = express();
  // requestId must run before anything that can throw (e.g. express.json()),
  // since the error handler relies on req.log existing.
  app.use(requestId);
  app.use(express.json({ limit: '1kb' }));

  app.get('/api-error', (_req, _res, next) => next(new ApiError(409, 'CONFLICT', 'custom conflict')));
  app.get('/zod-error', (_req, _res, next) => {
    const result = z.object({ x: z.string() }).safeParse({ x: 5 });
    next(result.error);
  });
  app.get('/unique-violation', (_req, _res, next) => next(fakePrismaError(PRISMA_ERROR.UNIQUE_VIOLATION)));
  app.get('/not-found', (_req, _res, next) => next(fakePrismaError(PRISMA_ERROR.RECORD_NOT_FOUND)));
  app.get('/fk-violation', (_req, _res, next) => next(fakePrismaError(PRISMA_ERROR.FK_VIOLATION)));
  app.get('/check-violation-unmapped', (_req, _res, next) =>
    next(fakePrismaError(PRISMA_ERROR.CHECK_VIOLATION)),
  );
  app.get('/unexpected', (_req, _res, next) => next(new Error('boom')));
  app.post('/json', (_req, res) => res.json({ ok: true }));

  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('maps ApiError to its own status/code/message', async () => {
    const res = await request(buildApp()).get('/api-error');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'CONFLICT', message: 'custom conflict' });
    expect(res.body.error.requestId).toBeTypeOf('string');
  });

  it('maps ZodError to 422 VALIDATION_FAILED with field-level details', async () => {
    const res = await request(buildApp()).get('/zod-error');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'x' })]),
    );
  });

  it('maps Prisma P2002 (unique violation) to 409 CONFLICT', async () => {
    const res = await request(buildApp()).get('/unique-violation');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('maps Prisma P2025 (not found) to 404 NOT_FOUND', async () => {
    const res = await request(buildApp()).get('/not-found');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('maps Prisma P2003 (FK/restrict violation) to 409 CONFLICT', async () => {
    const res = await request(buildApp()).get('/fk-violation');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('falls back to 500 INTERNAL for an unrecognised Prisma code and for any unexpected error', async () => {
    const unmapped = await request(buildApp()).get('/check-violation-unmapped');
    expect(unmapped.status).toBe(500);
    expect(unmapped.body.error.code).toBe('INTERNAL');

    const unexpected = await request(buildApp()).get('/unexpected');
    expect(unexpected.status).toBe(500);
    expect(unexpected.body.error.code).toBe('INTERNAL');
    expect(unexpected.body.error.message).toBe('Internal server error'); // generic — no leaked detail
  });

  it('maps a malformed JSON body to 400 BAD_REQUEST', async () => {
    const res = await request(buildApp())
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('{not valid json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('maps an oversized body to 413 BAD_REQUEST', async () => {
    const res = await request(buildApp())
      .post('/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ a: 'x'.repeat(2000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('a real ZodError instance is in fact what the central handler branches on', () => {
    const result = z.object({ y: z.number() }).safeParse({ y: 'no' });
    expect(result.error).toBeInstanceOf(ZodError);
  });
});
