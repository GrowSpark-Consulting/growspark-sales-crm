import express from 'express';
import helmet from 'helmet';
import { requestId } from './middleware/request-id.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(requestId);
  app.use(healthRouter);
  app.use('/api/v1', healthRouter);
  app.use(errorHandler);
  return app;
}
