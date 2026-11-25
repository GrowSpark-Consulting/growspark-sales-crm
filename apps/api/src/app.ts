import express, { type Express } from 'express';
import helmet from 'helmet';
import { requestId } from './middleware/request-id.js';
import { requestLog } from './middleware/request-log.js';
import { errorHandler } from './middleware/error-handler.js';
import { enforceOriginAndContentType } from './middleware/csrf.js';
import { attachApiKeyContext } from './middleware/api-key-auth.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { registerUsersRoutes } from './modules/users/users.routes.js';
import { registerAuditRoutes } from './modules/audit/audit.routes.js';
import { registerLeadSourcesRoutes } from './modules/lead-sources/lead-sources.routes.js';
import { registerCompaniesRoutes } from './modules/companies/companies.routes.js';
import { registerContactsRoutes } from './modules/contacts/contacts.routes.js';
import { registerLeadsRoutes } from './modules/leads/leads.routes.js';
import { registerDealsRoutes } from './modules/deals/deals.routes.js';
import { registerPipelineRoutes } from './modules/pipeline/pipeline.routes.js';
import { registerActivitiesRoutes } from './modules/activities/activities.routes.js';
import { registerWorkspaceRoutes } from './modules/workspace/workspace.routes.js';
import { registerApiKeysRoutes } from './modules/api-keys/api-keys.routes.js';
import { registerIntakeRoutes } from './modules/intake/intake.routes.js';
import { registerEnquiriesRoutes } from './modules/enquiries/enquiries.routes.js';
import { registerQuotationsRoutes } from './modules/quotations/quotations.routes.js';
import { registerNotificationsRoutes } from './modules/notifications/notifications.routes.js';
import { registerReportsRoutes } from './modules/reports/reports.routes.js';
import { registerSettingsRoutes } from './modules/settings/settings.routes.js';
import { registerSearchRoutes } from './modules/search/search.routes.js';
import { registerImportsRoutes, IMPORT_JSON_BODY_LIMIT, IMPORT_PATH_PREFIX } from './modules/imports/imports.routes.js';
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
  // D71: scoped to the intake path only, and mounted BEFORE
  // enforceOriginAndContentType — on a missing/invalid/revoked key this
  // rejects with 401 immediately, so the request never reaches the Origin
  // check at all in that case. Only on success does it attach
  // req.apiKeyCtx, which csrf.ts then uses to exempt the Origin check
  // (never the Content-Type check) for this one path.
  app.use('/api/v1/intake', attachApiKeyContext);
  app.use(enforceOriginAndContentType);
  // 100 KB for every route except CSV import (D95), whose body carries a
  // whole file of up to 1 MB. Chosen by path before parsing, so no other
  // route can ever accept a larger body.
  const defaultJson = express.json({ limit: '100kb' });
  const importJson = express.json({ limit: IMPORT_JSON_BODY_LIMIT });
  app.use((req, res, next) => (req.path.startsWith(IMPORT_PATH_PREFIX) ? importJson : defaultJson)(req, res, next));

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerUsersRoutes(app);
  registerAuditRoutes(app);
  registerLeadSourcesRoutes(app);
  registerCompaniesRoutes(app);
  registerContactsRoutes(app);
  registerLeadsRoutes(app);
  registerDealsRoutes(app);
  registerPipelineRoutes(app);
  registerActivitiesRoutes(app);
  registerWorkspaceRoutes(app);
  registerApiKeysRoutes(app);
  registerIntakeRoutes(app);
  registerEnquiriesRoutes(app);
  registerQuotationsRoutes(app);
  registerNotificationsRoutes(app);
  registerReportsRoutes(app);
  registerSettingsRoutes(app);
  registerSearchRoutes(app);
  registerImportsRoutes(app);
  options.extraRoutes?.(app);

  app.use(errorHandler);
  return app;
}
