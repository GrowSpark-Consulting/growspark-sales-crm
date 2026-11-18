import { Router } from 'express';
import { healthResponseSchema } from '@growspark/shared';
import { pool } from '../db/pool.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const body = healthResponseSchema.parse({ status: 'ok', timestamp: new Date().toISOString() });
  res.status(200).json(body);
});

healthRouter.get('/health/db', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    const body = healthResponseSchema.parse({ status: 'ok', timestamp: new Date().toISOString() });
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
});
