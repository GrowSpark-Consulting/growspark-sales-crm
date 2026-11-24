import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error-handler.js';
import { env } from '../env.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defense for cookie-authenticated writes: SameSite=Lax cookies already
 * block most cross-site form/fetch submissions, this adds a same-origin
 * check as a second layer plus a JSON-only body requirement. A missing
 * Origin header is rejected too (a same-origin fetch/XHR always sends one).
 *
 * D71: the one exemption is the Origin check (never the Content-Type check)
 * for the website intake path, and it is conditioned on req.apiKeyCtx
 * already being set, never on the request path alone. req.apiKeyCtx is only
 * ever set by attachApiKeyContext (middleware/api-key-auth.ts), which is
 * mounted before this middleware and already rejected the request with 401
 * on any missing/invalid/revoked key — so by the time this runs, a verified
 * API key is guaranteed. A request with a session cookie but no
 * Authorization header never reaches this exemption at all: it was already
 * rejected upstream.
 */
export function enforceOriginAndContentType(req: Request, _res: Response, next: NextFunction): void {
  if (!WRITE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (!req.apiKeyCtx) {
    const origin = req.header('origin');
    if (!origin || !env.ALLOWED_ORIGINS.includes(origin)) {
      next(new ApiError(403, 'FORBIDDEN', 'Origin not allowed.'));
      return;
    }
  }

  // Only requests that actually carry a body need a JSON content type — a
  // bodyless write (e.g. logout) legitimately has no Content-Type header at
  // all from a real fetch() call with no body to describe. The Origin check
  // above already fully defends against cross-site forgery either way: a
  // browser never lets script forge its own Origin header.
  const hasBody = Number(req.header('content-length') ?? '0') > 0 || req.header('transfer-encoding') != null;
  if (hasBody) {
    const contentType = req.header('content-type');
    if (!contentType || !contentType.toLowerCase().startsWith('application/json')) {
      next(new ApiError(415, 'BAD_REQUEST', 'Content-Type must be application/json.'));
      return;
    }
  }

  next();
}
