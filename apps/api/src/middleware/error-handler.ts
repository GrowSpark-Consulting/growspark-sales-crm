import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { PRISMA_ERROR, isKnownRequestError } from '../lib/prisma-errors.js';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * The shape body-parser (via http-errors) attaches to its own thrown errors.
 * Verified empirically against the installed body-parser@2.4.0: a malformed
 * JSON body carries `{ status: 400, type: 'entity.parse.failed' }`; an
 * oversized body carries `{ status: 413, type: 'entity.too.large' }'`.
 */
function isBodyParserError(
  err: unknown,
): err is { status: number; type: string; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    'type' in err &&
    (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')
  );
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.id;

  if (err instanceof ApiError) {
    req.log.warn({ errCode: err.code }, 'request failed');
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details, requestId },
    });
    return;
  }

  if (err instanceof ZodError) {
    req.log.warn('validation failed');
    res.status(422).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        requestId,
      },
    });
    return;
  }

  if (isBodyParserError(err)) {
    req.log.warn({ errType: err.type }, 'malformed request body');
    res.status(err.status).json({
      error: { code: 'BAD_REQUEST', message: err.message, requestId },
    });
    return;
  }

  // P2039 (CHECK_VIOLATION) is deliberately not mapped here and falls
  // through to the generic 500 below: a CHECK constraint firing means bad
  // data got past Zod validation, which is an unexpected server-side
  // condition to surface, not a normal client-facing outcome like a
  // duplicate or a missing record.
  if (isKnownRequestError(err)) {
    if (err.code === PRISMA_ERROR.UNIQUE_VIOLATION) {
      req.log.warn({ prismaCode: err.code }, 'unique constraint violated');
      res.status(409).json({ error: { code: 'CONFLICT', message: 'Already exists', requestId } });
      return;
    }
    if (err.code === PRISMA_ERROR.RECORD_NOT_FOUND) {
      req.log.warn({ prismaCode: err.code }, 'record not found');
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found', requestId } });
      return;
    }
    if (err.code === PRISMA_ERROR.FK_VIOLATION) {
      req.log.warn({ prismaCode: err.code }, 'foreign key / restrict violated');
      res.status(409).json({ error: { code: 'CONFLICT', message: 'Referenced by another record', requestId } });
      return;
    }
  }

  req.log.error({ err }, 'unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Internal server error', requestId },
  });
}
