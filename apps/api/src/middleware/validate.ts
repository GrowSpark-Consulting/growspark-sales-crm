import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

export interface RequestValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Parses body/params/query against the given Zod schemas, replacing the
 * (now-validated and normalised, e.g. trimmed/lowercased) values on the
 * request — except `query`, which Express 5 defines as a getter-only
 * accessor with no setter (verified against the installed express@5.3.0),
 * so the validated result goes on `req.validatedQuery` instead.
 *
 * Throws (via `next(err)`) the raw ZodError on failure; the central error
 * handler maps that to 422 VALIDATION_FAILED.
 */
export function validateRequest(schemas: RequestValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      if (schemas.query) {
        req.validatedQuery = schemas.query.parse(req.query);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
