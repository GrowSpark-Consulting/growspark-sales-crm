import { env } from '../../src/env.js';
import { SESSION_COOKIE_NAME } from '../../src/lib/cookies.js';

/** The Origin every test must send on a POST/PUT/PATCH/DELETE — enforceOriginAndContentType is global. */
export const ALLOWED_ORIGIN = env.ALLOWED_ORIGINS[0]!;

export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}`;
}
