import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  // Defense in depth: this app never deliberately logs a request body or the
  // cookie/authorization headers, but redact them anyway in case a future
  // change does.
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      '*.passwordHash',
    ],
    censor: '[REDACTED]',
  },
});
