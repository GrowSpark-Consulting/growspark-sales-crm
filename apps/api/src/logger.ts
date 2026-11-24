import pino from 'pino';
import { env } from './env.js';

// Defense in depth: this app never deliberately logs a request body or the
// cookie/authorization headers, but redact them anyway in case a future
// change does. Exported (not inlined into the pino() call below) so
// tests/logger.test.ts can both assert on the exact path list and feed it
// into a throwaway pino instance to prove it actually redacts, not just
// that the strings are present in this file.
export const LOG_REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["idempotency-key"]',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  '*.passwordHash',
];

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: LOG_REDACT_PATHS,
    censor: '[REDACTED]',
  },
});
