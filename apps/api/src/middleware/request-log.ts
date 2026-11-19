import type { NextFunction, Request, Response } from 'express';

/**
 * One log line per request: request id, user id (once the session middleware
 * has set req.ctx), route, status and duration. Never the body, headers, or
 * anything from them — see docs/decisions.md.
 */
export function requestLog(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    req.log.info(
      {
        method: req.method,
        route: req.route?.path ?? req.path,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        userId: req.ctx?.userId,
      },
      'request completed',
    );
  });

  next();
}
