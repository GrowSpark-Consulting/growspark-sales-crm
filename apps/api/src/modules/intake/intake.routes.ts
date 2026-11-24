import type { Application } from 'express';
import { defineRoute } from '../../lib/route-registry.js';
import { intakeKeyRateLimiter, intakeIpRateLimiter } from '../../lib/rate-limit.js';
import { ApiError } from '../../middleware/error-handler.js';
import * as intakeService from './intake.service.js';

export function registerIntakeRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/intake/website-enquiries',
    auth: 'apiKey',
    // D71: deliberately NOT `validate: { body: websiteEnquiryIntakeSchema }`,
    // which would run unconditionally before any handler code — a repeat
    // Idempotency-Key must win over body validation (return the original
    // result even if the new body would itself fail validation), so the
    // service does its own (organizationId, externalId) lookup against the
    // raw body first, and only calls the schema's .parse() itself once no
    // existing row is found. See intake.service.ts's processWebsiteIntake.
    middlewares: [intakeKeyRateLimiter, intakeIpRateLimiter],
    handler: async (req, res, next) => {
      try {
        const idempotencyKey = req.header('idempotency-key')?.trim();
        if (!idempotencyKey) {
          throw new ApiError(422, 'VALIDATION_FAILED', 'Idempotency-Key header is required.');
        }
        const outcome = await intakeService.processWebsiteIntake(req.apiKeyCtx!, idempotencyKey, req.body);
        res.status(outcome.statusCode).json(outcome.body);
      } catch (err) {
        next(err);
      }
    },
  });
}
