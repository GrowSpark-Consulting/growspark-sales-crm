import { parseCookie, stringifySetCookie } from 'cookie';
import { env } from '../env.js';

export const SESSION_COOKIE_NAME = 'crm_session';

/**
 * cookie@2.x renamed the classic `serialize`/`parse` exports to
 * `stringifySetCookie`/`parseCookie` (verified against its generated .d.ts —
 * there is no `serialize`/`parse` export in this major version).
 *
 * `secure` is a parameter rather than read from env directly, so the
 * NODE_ENV-dependent behaviour is a plain, independently testable function
 * instead of something only observable by actually running in production.
 */
export function buildSessionCookieHeaderFor(token: string, secure: boolean): string {
  return stringifySetCookie({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export function buildClearedSessionCookieHeaderFor(secure: boolean): string {
  return stringifySetCookie({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: 0,
  });
}

export function buildSessionCookieHeader(token: string): string {
  return buildSessionCookieHeaderFor(token, env.NODE_ENV === 'production');
}

export function buildClearedSessionCookieHeader(): string {
  return buildClearedSessionCookieHeaderFor(env.NODE_ENV === 'production');
}

export function readSessionToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  return parseCookie(cookieHeader)[SESSION_COOKIE_NAME];
}
