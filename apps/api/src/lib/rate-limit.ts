import { rateLimit, ipKeyGenerator, MemoryStore } from 'express-rate-limit';
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

const INTAKE_WINDOW_MS = 60 * 1000;

/**
 * Per-verified-API-key limit on the website intake route — the real
 * protection in production (D71). Unlike the login limiters above, every
 * request counts here (no skipSuccessfulRequests): this bounds request
 * *volume* per key, not failed-attempt brute-forcing. Matches the original
 * roadmap's own number.
 */
export const INTAKE_KEY_MAX_REQUESTS_PER_MINUTE = 60;

/**
 * A secondary, much looser per-IP layer on the same route. Honestly
 * expected to do little to nothing once this runs on Render (D71):
 * TRUST_PROXY stays false (D60, not being changed here), and Render's own
 * edge/load balancer almost certainly still sits in front of the Express
 * service even for a direct server-to-server hit, so req.ip there likely
 * shows Render's edge address, not the real calling website's — collapsing
 * this into one shared counter in practice, the same failure mode D21
 * already found and abandoned for login. Kept anyway as a cheap extra
 * layer, never relied on as the real defense.
 */
export const INTAKE_IP_MAX_REQUESTS_PER_MINUTE = 120;

function tooManyIntakeRequests(): ApiError {
  return new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again later.');
}

const intakeKeyStore = new MemoryStore();
export const intakeKeyRateLimiter = rateLimit({
  windowMs: INTAKE_WINDOW_MS,
  limit: INTAKE_KEY_MAX_REQUESTS_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  store: intakeKeyStore,
  // Runs after attachApiKeyContext (app.ts), so req.apiKeyCtx is always set
  // by the time this executes — 'unknown' is unreachable in practice, kept
  // only so a missing key can never collapse into "no limit" instead.
  keyGenerator: (req: Request): string => `key:${req.apiKeyCtx?.apiKeyId ?? 'unknown'}`,
  handler: (_req, _res, next) => next(tooManyIntakeRequests()),
});

/**
 * A ceiling-parameterised factory, same reasoning as
 * createGlobalLoginFloodLimiter above: lets a test prove the mechanism trips
 * at a configured threshold without sending 120+ real requests against the
 * production ceiling. The production singleton below is just this factory
 * called once with the real ceiling.
 */
export function createIntakeIpRateLimiter(
  ceiling: number,
  windowMs: number = INTAKE_WINDOW_MS,
): { limiter: RequestHandler; reset: () => Promise<void> } {
  const store = new MemoryStore();
  const limiter = rateLimit({
    windowMs,
    limit: ceiling,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    // ipKeyGenerator (not req.ip directly) normalises an IPv6 address to its
    // /56 subnet first — found by actually running this server outside
    // vitest (Docker, Day 5 part b): express-rate-limit 8.x validates this
    // at construction time and logs ERR_ERL_KEY_GEN_IPV6 otherwise, because
    // an un-normalised IPv6 key lets one caller trivially rotate through
    // billions of distinct req.ip values from a single /64 allocation,
    // defeating the limiter entirely.
    keyGenerator: (req: Request): string => `ip:${req.ip ? ipKeyGenerator(req.ip) : 'unknown'}`,
    handler: (_req, _res, next) => next(tooManyIntakeRequests()),
  });
  return { limiter, reset: () => store.resetAll() };
}

const defaultIntakeIp = createIntakeIpRateLimiter(INTAKE_IP_MAX_REQUESTS_PER_MINUTE);
export const intakeIpRateLimiter = defaultIntakeIp.limiter;

/** Test-only: see resetLoginRateLimiters above. */
export async function resetIntakeRateLimiters(): Promise<void> {
  await Promise.all([intakeKeyStore.resetAll(), defaultIntakeIp.reset()]);
}
