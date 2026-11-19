import express, { type Express } from 'express';
import helmet from 'helmet';
import { requestId } from './middleware/request-id.js';
import { requestLog } from './middleware/request-log.js';
import { errorHandler } from './middleware/error-handler.js';
import { enforceOriginAndContentType } from './middleware/csrf.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { resetRouteRegistry } from './lib/route-registry.js';
import { env } from './env.js';

export interface CreateAppOptions {
  /**
   * Test-only: register additional routes (via defineRoute) before the error
   * handler is wired, so their errors still flow through it. A route added
   * after createApp() returns would land after the error handler in the
   * middleware stack — Express would never route next(err) back to it.
   */
  extraRoutes?: (app: Express) => void;
}

export function createApp(options: CreateAppOptions = {}): Express {
  // Every createApp() call represents one app instance; the registry should
  // reflect exactly that instance's routes, not accumulate across calls.
  resetRouteRegistry();

  const app = express();
  // TRUST_PROXY is "false" in this app's current architecture on purpose —
  // see docs/decisions.md D21/D23: the Next.js web app's rewrite() proxy
  // forwards neither X-Forwarded-For nor X-Forwarded-Proto, so there is
  // nothing genuine to trust yet. Still env-driven (not hard-coded) so a
  // future deployment that does forward real client info only needs a
  // config change, not a code change.
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());
  app.use(requestId);
  app.use(requestLog);
  app.use(enforceOriginAndContentType);
  app.use(express.json({ limit: '100kb' }));

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  options.extraRoutes?.(app);

  app.use(errorHandler);
  return app;
}
