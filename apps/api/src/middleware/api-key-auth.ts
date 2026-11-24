import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error-handler.js';
import { prisma } from '../db/prisma.js';
import { hashApiKey, verifyApiKeyHash } from '../lib/api-key.js';

const UNAUTHENTICATED = () => new ApiError(401, 'UNAUTHENTICATED', 'A valid API key is required.');

const BEARER_PREFIX = 'Bearer ';

/**
 * Authenticates the website intake path by API key, not a session. Mounted
 * globally in app.ts but scoped to '/api/v1/intake' only, BEFORE
 * enforceOriginAndContentType (csrf.ts) — see docs/decisions.md D71's
 * "Origin exemption" bullet for why that order matters.
 *
 * On a missing/malformed Authorization header, an unknown key, or a revoked
 * key, this rejects with 401 immediately: the request never reaches the
 * Origin check at all in that case, so a bad or absent key can never be
 * masked by (or benefit from) a 403 "Origin not allowed" instead. Only on
 * success does it attach req.apiKeyCtx; csrf.ts then exempts the Origin
 * check (never the Content-Type check) only when req.apiKeyCtx is already
 * set — which, by construction, can only be true here, after authentication
 * already succeeded. A session cookie with no Authorization header hitting
 * this route is rejected here with 401, before csrf.ts's logic even runs.
 *
 * revokedAt is checked fresh on every single request (no caching), so a
 * revoked or rotated key stops working on its very next use.
 */
export async function attachApiKeyContext(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization');
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      next(UNAUTHENTICATED());
      return;
    }

    const key = header.slice(BEARER_PREFIX.length).trim();
    if (!key) {
      next(UNAUTHENTICATED());
      return;
    }

    const keyHash = hashApiKey(key);
    const found = await prisma.apiKey.findUnique({ where: { keyHash } });
    if (!found || found.revokedAt || !verifyApiKeyHash(keyHash, found.keyHash)) {
      next(UNAUTHENTICATED());
      return;
    }

    await prisma.apiKey.update({ where: { id: found.id }, data: { lastUsedAt: new Date() } });

    req.apiKeyCtx = {
      organizationId: found.organizationId,
      apiKeyId: found.id,
      keyPrefix: found.keyPrefix,
    };
    next();
  } catch (err) {
    next(err);
  }
}
