import type { Logger } from 'pino';
import type { RequestContext, ApiKeyContext } from '../lib/context.js';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
    log: Logger;
    /** Set by the session middleware for every non-public route. */
    ctx?: RequestContext;
    /** Set by attachApiKeyContext for the intake path only, on a verified, non-revoked API key. */
    apiKeyCtx?: ApiKeyContext;
    /**
     * Query params after Zod validation. Express 5 defines `req.query` as a
     * getter-only accessor (no setter) — verified against the installed
     * express@5.3.0's lib/request.js — so a validated query cannot be
     * written back onto `req.query` itself and lives here instead.
     */
    validatedQuery?: unknown;
  }
}
