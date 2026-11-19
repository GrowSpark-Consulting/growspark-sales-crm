import type { Application } from 'express';
import {
  loginSchema,
  changePasswordSchema,
  meResponseSchema,
  type LoginInput,
  type ChangePasswordInput,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import { buildSessionCookieHeader, buildClearedSessionCookieHeader, readSessionToken } from '../../lib/cookies.js';
import { loginIpRateLimiter, loginEmailRateLimiter } from '../../lib/rate-limit.js';
import * as authService from './auth.service.js';

export function registerAuthRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/auth/login',
    auth: 'public',
    validate: { body: loginSchema },
    // Rate limiters run after validation so the per-email key is already
    // normalised (trimmed, lowercased).
    middlewares: [loginIpRateLimiter, loginEmailRateLimiter],
    handler: async (req, res, next) => {
      try {
        const { email, password } = req.body as LoginInput;
        const result = await authService.login(email, password);
        res.setHeader('Set-Cookie', buildSessionCookieHeader(result.token));
        res.status(200).json({ data: meResponseSchema.parse(result.me) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/auth/logout',
    auth: 'authenticated',
    handler: async (req, res, next) => {
      try {
        const token = readSessionToken(req.headers.cookie);
        if (token) {
          await authService.logout(token);
        }
        res.setHeader('Set-Cookie', buildClearedSessionCookieHeader());
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/auth/me',
    auth: 'authenticated',
    handler: async (req, res, next) => {
      try {
        // Safe: attachSessionContext (wired in by defineRoute for every
        // non-public route) always sets req.ctx before this handler runs.
        const me = await authService.getMe(req.ctx!);
        res.status(200).json({ data: meResponseSchema.parse(me) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/auth/change-password',
    auth: 'authenticated',
    validate: { body: changePasswordSchema },
    handler: async (req, res, next) => {
      try {
        const { currentPassword, newPassword } = req.body as ChangePasswordInput;
        const result = await authService.changePassword(req.ctx!, currentPassword, newPassword);
        res.setHeader('Set-Cookie', buildSessionCookieHeader(result.token));
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  });
}
