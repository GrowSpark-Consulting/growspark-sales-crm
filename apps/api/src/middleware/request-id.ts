import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../logger.js';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.id = req.header('x-request-id') ?? randomUUID();
  req.log = logger.child({ requestId: req.id });
  res.setHeader('x-request-id', req.id);
  next();
}
