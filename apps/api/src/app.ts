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
   * Overrides env.TRUST_PROXY for this instance. Exists so tests can run an
   * app instance that trusts X-Forwarded-For (to simulate requests arriving
   * through a proxy) without changing the real dev/prod configuration.
   */
  trustProxy?: boolean | number;
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
  app.set('trust proxy', options.trustProxy ?? env.TRUST_PROXY);

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
