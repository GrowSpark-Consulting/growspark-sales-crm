import request from 'supertest';
import { prisma } from '../../src/db/prisma.js';
import { createApp } from '../../src/app.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from './http.js';
import type { TestTenant } from './tenant.js';

export type TestApp = ReturnType<typeof createApp>;

export function authed(app: TestApp, token: string) {
  const cookie = sessionCookieHeader(token);
  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    post: (path: string, body?: object) =>
      request(app).post(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
    patch: (path: string, body?: object) =>
      request(app).patch(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
  };
}

export async function signIn(app: TestApp, tenant: TestTenant, role: 'admin' | 'staff' = 'admin') {
  const user = role === 'admin' ? tenant.adminUser : tenant.staffUser;
  const { token } = await createSession(tenant.organization.id, user.id);
  return authed(app, token);
}

/** A company, a contact at it, and an open deal for it — the usual quotation context. */
export async function createQuotationContext(tenant: TestTenant, name = 'Example Foods') {
  const organizationId = tenant.organization.id;
  const company = await prisma.company.create({ data: { organizationId, name, nameNormalized: name.toLowerCase() } });
  const contact = await prisma.contact.create({
    data: { organizationId, companyId: company.id, firstName: 'Asha', lastName: 'Rao', email: 'asha@example.test', emailNormalized: 'asha@example.test' },
  });
  const deal = await prisma.deal.create({
    data: {
      organizationId,
      name: `${name} automation`,
      companyId: company.id,
      pipelineId: tenant.pipeline.id,
      stageId: tenant.stages[0]!.id,
      probability: tenant.stages[0]!.probability,
      ownerId: tenant.adminUser.id,
    },
  });
  return { company, contact, deal };
}

/** The awkward example from the brief: 3 × 0.10, 33.33% discount, 18% GST -> total 0.24. */
export const AWKWARD_LINES = [{ description: 'Sensor labels', quantity: '3', unitPrice: '0.10' }];

export function quotationBody(context: Awaited<ReturnType<typeof createQuotationContext>>, extra: object = {}) {
  return {
    companyId: context.company.id,
    contactId: context.contact.id,
    dealId: context.deal.id,
    lineItems: [
      { description: 'Discovery workshop', quantity: '2', unitPrice: '45000.00', discountPercent: '10' },
      { description: 'Process mapping', quantity: '1', unitPrice: '125000.00' },
    ],
    ...extra,
  };
}
