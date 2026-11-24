import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';
import { LOG_REDACT_PATHS } from '../src/logger.js';

function captureStream() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  return { stream, lines: () => chunks.join('').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) };
}

describe('logger redaction', () => {
  it('the redact path list names the Idempotency-Key header and the Authorization header', () => {
    expect(LOG_REDACT_PATHS).toContain('req.headers["idempotency-key"]');
    expect(LOG_REDACT_PATHS).toContain('req.headers.authorization');
  });

  it('actually redacts both headers when logged (via a pino instance built from the real, exported config), leaving an unrelated field untouched', () => {
    const { stream, lines } = captureStream();
    // The exact redact config this app's real logger uses — built here
    // against a capturable stream instead of the real logger's own fixed
    // destination, so the resulting log line can be parsed and asserted on.
    const testLogger = pino({ redact: { paths: LOG_REDACT_PATHS, censor: '[REDACTED]' } }, stream);

    testLogger.info(
      {
        req: {
          headers: {
            'idempotency-key': 'real-submission-uuid-should-not-leak',
            authorization: 'Bearer gsk_live_realkeyshouldnotleak',
            'content-type': 'application/json',
          },
        },
      },
      'request completed',
    );

    const [logged] = lines();
    expect(logged.req.headers['idempotency-key']).toBe('[REDACTED]');
    expect(logged.req.headers.authorization).toBe('[REDACTED]');
    // An unrelated field must pass through untouched — otherwise this test
    // would also pass if redact silently blanked the whole headers object.
    expect(logged.req.headers['content-type']).toBe('application/json');

    const serialized = JSON.stringify(logged);
    expect(serialized).not.toContain('real-submission-uuid-should-not-leak');
    expect(serialized).not.toContain('gsk_live_realkeyshouldnotleak');
  });

  it('also redacts req.headers.cookie and req.body password fields, same config', () => {
    const { stream, lines } = captureStream();
    const testLogger = pino({ redact: { paths: LOG_REDACT_PATHS, censor: '[REDACTED]' } }, stream);

    testLogger.info(
      {
        req: {
          headers: { cookie: 'crm_session=should-not-leak' },
          body: { password: 'hunter2', currentPassword: 'old-hunter2', newPassword: 'new-hunter2', email: 'keep@example.com' },
        },
      },
      'request completed',
    );

    const [logged] = lines();
    expect(logged.req.headers.cookie).toBe('[REDACTED]');
    expect(logged.req.body.password).toBe('[REDACTED]');
    expect(logged.req.body.currentPassword).toBe('[REDACTED]');
    expect(logged.req.body.newPassword).toBe('[REDACTED]');
    expect(logged.req.body.email).toBe('keep@example.com');
  });
});
