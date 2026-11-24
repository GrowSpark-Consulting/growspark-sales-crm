import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/db/prisma.js';
import { ALLOWED_ORIGIN } from './http.js';
import type { TestTenant } from './tenant.js';

/**
 * The real seed (prisma/seed-lib.ts) creates a "Website" LeadSource;
 * createTestTenant() deliberately does not (it only creates one generic
 * "Source-<uuid>"), so intake tests that expect a successful Lead creation
 * must create one explicitly — the same pattern tests/leads/crud.test.ts
 * already uses for "Manual".
 */
export async function ensureWebsiteLeadSource(tenant: TestTenant): Promise<void> {
  await prisma.leadSource.create({
    data: { organizationId: tenant.organization.id, name: 'Website', sortOrder: 0 },
  });
}

/** POST /api/v1/intake/website-enquiries with a valid Origin and JSON Content-Type — the normal, successful-path shape. */
export function intakeRequest(app: Express, key: string, idempotencyKey: string, body: unknown) {
  return request(app)
    .post('/api/v1/intake/website-enquiries')
    .set('Authorization', `Bearer ${key}`)
    .set('Idempotency-Key', idempotencyKey)
    .set('Origin', ALLOWED_ORIGIN)
    .set('Content-Type', 'application/json')
    .send(body as object);
}
