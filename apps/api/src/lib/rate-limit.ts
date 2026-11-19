import { rateLimit, MemoryStore } from 'express-rate-limit';
import type { Request } from 'express';
import { ApiError } from '../middleware/error-handler.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function tooManyAttempts(): ApiError {
  return new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.');
}

/**
 * Two independent in-memory stores/limiters, per the brief: 10 attempts per
 * 15 minutes per IP AND 10 per 15 minutes per normalised email — either one
 * tripping blocks the request. In-memory means these limits reset on
 * restart and are per-process; acceptable for a single-instance deployment,
 * recorded in docs/decisions.md.
 */
const loginIpStore = new MemoryStore();
export const loginIpRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: loginIpStore,
  handler: (_req, _res, next) => next(tooManyAttempts()),
});

const loginEmailStore = new MemoryStore();
export const loginEmailRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: loginEmailStore,
  // Runs after validateRequest in the route's middleware chain, so
  // req.body.email is already the normalised (trimmed, lowercased) address.
  keyGenerator: (req: Request): string => {
    const email = typeof req.body?.email === 'string' ? req.body.email : 'unknown';
    return `email:${email}`;
  },
  handler: (_req, _res, next) => next(tooManyAttempts()),
});

/**
 * Test-only: these are in-memory singletons, so counters persist across
 * tests in the same process unless explicitly cleared.
 */
export async function resetLoginRateLimiters(): Promise<void> {
  await Promise.all([loginIpStore.resetAll(), loginEmailStore.resetAll()]);
}
