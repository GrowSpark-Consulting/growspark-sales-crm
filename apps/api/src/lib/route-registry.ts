import type { Application, RequestHandler } from 'express';
import { hasPermission, type Permission } from '@growspark/shared';
import { ApiError } from '../middleware/error-handler.js';
import { attachSessionContext } from '../middleware/session.js';
import { validateRequest, type RequestValidationSchemas } from '../middleware/validate.js';

export type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

/**
 * 'public': no session required (health checks, login).
 * 'authenticated': any signed-in user, no specific permission (logout, me,
 * change-password).
 * 'apiKey': authenticated by attachApiKeyContext (middleware/api-key-auth.ts)
 * before the route's own chain runs — no session, no permission check here.
 * A Permission string: session required AND that permission.
 */
export type RouteAuth = 'public' | 'authenticated' | 'apiKey' | Permission;

export interface RouteRecord {
  method: HttpMethod;
  path: string;
  auth: RouteAuth;
}

const registry: RouteRecord[] = [];

export function getRegisteredRoutes(): readonly RouteRecord[] {
  return registry;
}

/** Test-only: each test that builds a fresh app via createApp() should start with an empty registry. */
export function resetRouteRegistry(): void {
  registry.length = 0;
}

export interface DefineRouteOptions {
  app: Application;
  method: HttpMethod;
  /** Full path as mounted from the app root, e.g. '/api/v1/auth/login'. */
  path: string;
  auth: RouteAuth;
  validate?: RequestValidationSchemas;
  /** Inserted after validation, before the handler — e.g. a route-specific rate limiter. */
  middlewares?: RequestHandler[];
  handler: RequestHandler;
}

function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.ctx || !hasPermission(req.ctx.role, permission)) {
      next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
      return;
    }
    next();
  };
}

/**
 * The single place every route is declared: records it in the registry (so
 * the route-registry test can prove no route was added any other way) and
 * wires session/permission/validation middleware consistently. Never call
 * app.get/post/etc. directly outside this function.
 */
export function defineRoute(options: DefineRouteOptions): void {
  const { app, method, path, auth, validate, middlewares = [], handler } = options;

  registry.push({ method, path, auth });

  const chain: RequestHandler[] = [];
  // 'apiKey' routes are already authenticated by attachApiKeyContext, mounted
  // globally on their path before defineRoute's own chain ever runs (see
  // app.ts and docs/decisions.md D71) — no session context, no permission
  // check here.
  if (auth !== 'public' && auth !== 'apiKey') {
    chain.push(attachSessionContext);
  }
  if (auth !== 'public' && auth !== 'authenticated' && auth !== 'apiKey') {
    chain.push(requirePermission(auth));
  }
  if (validate) {
    chain.push(validateRequest(validate));
  }
  chain.push(...middlewares);

  switch (method) {
    case 'get':
      app.get(path, ...chain, handler);
      break;
    case 'post':
      app.post(path, ...chain, handler);
      break;
    case 'patch':
      app.patch(path, ...chain, handler);
      break;
    case 'put':
      app.put(path, ...chain, handler);
      break;
    case 'delete':
      app.delete(path, ...chain, handler);
      break;
  }
}
