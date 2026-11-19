import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error-handler.js';
import { readSessionToken } from '../lib/cookies.js';
import { findValidSession, touchSession } from '../lib/session.js';
import { toSharedRole } from '../lib/context.js';

const UNAUTHENTICATED = () => new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');

/**
 * Loads the session from the cookie and attaches req.ctx. Applied by
 * defineRoute to every non-public route — never call this directly from a
 * route handler.
 */
export async function attachSessionContext(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readSessionToken(req.headers.cookie);
    if (!token) {
      next(UNAUTHENTICATED());
      return;
    }

    const result = await findValidSession(token);
    if (!result || !result.user.isActive) {
      next(UNAUTHENTICATED());
      return;
    }

    await touchSession(result.session);

    req.ctx = {
      userId: result.user.id,
      orgId: result.user.organizationId,
      role: toSharedRole(result.user.role),
    };
    next();
  } catch (err) {
    next(err);
  }
}
