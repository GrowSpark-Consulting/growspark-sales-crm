import { rateLimit, MemoryStore } from 'express-rate-limit';
import type { Request, RequestHandler } from 'express';
import { ApiError } from '../middleware/error-handler.js';

const WINDOW_MS = 15 * 60 * 1000;

/** Per normalised email, failed attempts only. */
export const LOGIN_EMAIL_MAX_FAILED_ATTEMPTS = 10;

/** Global ceiling across every login attempt, regardless of email or IP — see the comment below. */
export const LOGIN_GLOBAL_FLOOD_DEFAULT_CEILING = 50;

function tooManyAttempts(): ApiError {
  return new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.');
}

/**
 * Per-email failed-login limiter: 10 failed attempts per 15 minutes per
 * normalised email. `skipSuccessfulRequests` means a 2xx response is never
 * counted — only a 4xx/5xx one is (wrong password, unknown email, inactive
 * user, or a malformed request body all count; a correct login never
 * contributes, however many times in a row).
 */
const loginEmailStore = new MemoryStore();
export const loginEmailRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: LOGIN_EMAIL_MAX_FAILED_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: loginEmailStore,
  // Runs after validateRequest in the route's middleware chain, so
  // req.body.email is already the normalised (trimmed, lowercased) address.
  keyGenerator: (req: Request): string => {
    const email = typeof req.body?.email === 'string' ? req.body.email : 'unknown';
    return `email:${email}`;
  },
  handler: (_req, _res, next) => next(tooManyAttempts()),
});

const GLOBAL_FLOOD_KEY = 'global';

/**
 * A GLOBAL ceiling, not a per-client limit: every failed login attempt,
 * from anyone, counts against one shared counter. This replaces what was
 * originally meant to be a per-IP limiter (see docs/decisions.md D21): this
 * API sits behind the Next.js web app's rewrite() proxy, which forwards
 * neither X-Forwarded-For nor X-Forwarded-Proto, so every request arriving
 * through the normal browser path looks like it comes from the same
 * address anyway — a "per-IP" limiter here would already have been a
 * global counter in practice, just under a misleading name. This makes
 * that explicit and sets the ceiling high enough (50) that normal
 * multi-user usage never approaches it, only an actual flood does. Genuine
 * per-client-IP limiting needs the real client IP to reach this process,
 * which is a deployment-architecture decision (see D21/D23) — revisit then.
 *
 * `ceiling` is a constructor parameter (not a module-level constant) so
 * tests can build an isolated instance with a low threshold without
 * touching the real production limiter's configuration.
 */
export function createGlobalLoginFloodLimiter(ceiling: number): {
  limiter: RequestHandler;
  reset: () => Promise<void>;
} {
  const store = new MemoryStore();
  const limiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: ceiling,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    store,
    keyGenerator: () => GLOBAL_FLOOD_KEY,
    handler: (_req, _res, next) => next(tooManyAttempts()),
  });
  return { limiter, reset: () => store.resetAll() };
}

const defaultGlobalFlood = createGlobalLoginFloodLimiter(LOGIN_GLOBAL_FLOOD_DEFAULT_CEILING);
export const loginGlobalFloodLimiter = defaultGlobalFlood.limiter;

/**
 * Test-only: these are in-memory singletons, so counters persist across
 * tests in the same process unless explicitly cleared.
 */
export async function resetLoginRateLimiters(): Promise<void> {
  await Promise.all([loginEmailStore.resetAll(), defaultGlobalFlood.reset()]);
}
