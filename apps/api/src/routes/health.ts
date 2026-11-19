import type { Application, RequestHandler } from 'express';
import { healthResponseSchema } from '@growspark/shared';
import { pool } from '../db/pool.js';
import { defineRoute } from '../lib/route-registry.js';

const getHealth: RequestHandler = (_req, res) => {
  const body = healthResponseSchema.parse({ status: 'ok', timestamp: new Date().toISOString() });
  res.status(200).json(body);
};

const getHealthDb: RequestHandler = async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    const body = healthResponseSchema.parse({ status: 'ok', timestamp: new Date().toISOString() });
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
};

/**
 * Registered at both the root and the /api/v1 prefix (four defineRoute
 * calls sharing two handlers) rather than one Router mounted twice, so each
 * exposed path has its own registry entry — the route-registry test walks
 * the real app and expects a 1:1 match with what's registered here.
 */
export function registerHealthRoutes(app: Application): void {
  defineRoute({ app, method: 'get', path: '/health', auth: 'public', handler: getHealth });
  defineRoute({ app, method: 'get', path: '/health/db', auth: 'public', handler: getHealthDb });
  defineRoute({ app, method: 'get', path: '/api/v1/health', auth: 'public', handler: getHealth });
  defineRoute({ app, method: 'get', path: '/api/v1/health/db', auth: 'public', handler: getHealthDb });
}
