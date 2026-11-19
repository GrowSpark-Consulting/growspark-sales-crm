import type { Application } from 'express';
import type { HttpMethod, RouteRecord } from '../../src/lib/route-registry.js';

/**
 * Express 5's internal route tree shape — not part of @types/express's
 * public surface. Verified empirically against the installed express@5.3.0:
 * `app.router.stack` (not Express 4's `app._router.stack`) holds the layers;
 * each layer carries a `rawPath` (the path segment it was mounted at, e.g.
 * '/api/v1' for a nested router, or the route's own path at a leaf), so a
 * full path is reconstructed by concatenating `rawPath` down to each leaf
 * `route` layer. This is test-only introspection used to prove no route
 * bypasses defineRoute — production code never relies on this shape.
 */
interface ExpressInternalLayer {
  rawPath?: string;
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: ExpressInternalLayer[] };
}

function getRouterStack(app: Application): ExpressInternalLayer[] {
  return (app as unknown as { router: { stack: ExpressInternalLayer[] } }).router.stack;
}

export interface RealRoute {
  method: HttpMethod;
  path: string;
}

const METHODS: HttpMethod[] = ['get', 'post', 'patch', 'put', 'delete'];

/** Every route the running app actually answers to, regardless of how it was registered. */
export function listRealRoutes(app: Application): RealRoute[] {
  const results: RealRoute[] = [];

  function walk(stack: ExpressInternalLayer[], prefix: string): void {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of METHODS) {
          if (layer.route.methods[method]) {
            results.push({ method, path: prefix + layer.route.path });
          }
        }
      } else if (layer.handle?.stack) {
        walk(layer.handle.stack, prefix + (layer.rawPath ?? ''));
      }
    }
  }

  walk(getRouterStack(app), '');
  return results;
}

function routeKey(route: { method: string; path: string }): string {
  return `${route.method.toUpperCase()} ${route.path}`;
}

export interface RouteAuditResult {
  /** Real routes with no matching registry entry — bypassed defineRoute. */
  unregistered: RealRoute[];
  /** Registry entries with no matching real route — stale bookkeeping. */
  stale: RouteRecord[];
}

export function auditRoutes(app: Application, registered: readonly RouteRecord[]): RouteAuditResult {
  const real = listRealRoutes(app);
  const registeredKeys = new Set(registered.map(routeKey));
  const realKeys = new Set(real.map(routeKey));

  return {
    unregistered: real.filter((route) => !registeredKeys.has(routeKey(route))),
    stale: registered.filter((route) => !realKeys.has(routeKey(route))),
  };
}
