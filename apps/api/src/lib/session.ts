import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { env } from '../env.js';
import type { Session, User } from '../generated/prisma/client.js';

/** Sliding expiry is extended on activity, but the DB write is throttled to
 * at most once per this interval per session, so a busy user doesn't write
 * a session row on every single request. */
const TOUCH_THROTTLE_MS = 10 * 60 * 1000;

function sessionTtlMs(): number {
  return env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreatedSession {
  token: string;
  session: Session;
}

export async function createSession(organizationId: string, userId: string): Promise<CreatedSession> {
  const token = generateSessionToken();
  const now = new Date();
  const session = await prisma.session.create({
    data: {
      organizationId,
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(now.getTime() + sessionTtlMs()),
      lastSeenAt: now,
    },
  });
  return { token, session };
}

export interface ValidSession {
  session: Session;
  user: User;
}

/** Returns null for a missing, expired session — it never distinguishes which to the caller. */
export async function findValidSession(token: string): Promise<ValidSession | null> {
  const tokenHash = hashSessionToken(token);
  const found = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!found) {
    return null;
  }
  if (found.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  const { user, ...session } = found;
  return { session, user };
}

/** Extends expiry on activity, throttled — see TOUCH_THROTTLE_MS. */
export async function touchSession(session: Session): Promise<void> {
  const now = Date.now();
  if (now - session.lastSeenAt.getTime() < TOUCH_THROTTLE_MS) {
    return;
  }
  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date(now), expiresAt: new Date(now + sessionTtlMs()) },
  });
}

/** deleteMany, not delete: logging out with an already-gone session must not throw. */
export async function deleteSessionByToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

export async function deleteAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
