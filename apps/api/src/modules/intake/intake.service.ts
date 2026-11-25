import { websiteEnquiryIntakeSchema, intakeResponseSchema, normalizeEmail, normalizePhone, normalizeCompanyName } from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../middleware/error-handler.js';
import { findDuplicateLeads } from '../../lib/duplicates.js';
import { mapIntakeFields } from './intake-mapping.js';
import { notifyNewEnquiry } from '../notifications/notifications.service.js';
import type { ApiKeyContext } from '../../lib/context.js';
import type { Prisma, WebsiteSubmission } from '../../generated/prisma/client.js';

export interface IntakeOutcome {
  statusCode: number;
  body: unknown;
}

/**
 * actorId is always null here — intake has no human actor, only a verified
 * API key. Deliberately bypasses the shared writeAudit() helper (lib/audit.ts),
 * which hard-codes actorId to a RequestContext's userId; this path has no such
 * context at all (D71). metadata carries only submissionId and the key's
 * display prefix — never the raw key, the Idempotency-Key value, or any
 * enquiry field.
 */
async function writeIntakeAudit(
  tx: Prisma.TransactionClient,
  params: { action: string; organizationId: string; submissionId: string; apiKeyPrefix: string },
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      organizationId: params.organizationId,
      actorId: null,
      action: params.action,
      entityType: 'websiteSubmission',
      entityId: params.submissionId,
      metadata: { submissionId: params.submissionId, apiKeyPrefix: params.apiKeyPrefix } as Prisma.InputJsonValue,
    },
  });
}

/**
 * A repeat of an already-known Idempotency-Key returns the ORIGINAL result,
 * untouched — never re-validated, never re-processed (D71). A previously
 * REJECTED submission replays as the same 422 with the same stored message;
 * anything else (LEAD_CREATED, SPAM) replays as the same success shape with
 * duplicate: true and no new possibleDuplicateLeadIds search (the original
 * call already surfaced whatever there was to surface).
 */
function buildReplayOutcome(existing: WebsiteSubmission): IntakeOutcome {
  if (existing.status === 'REJECTED') {
    throw new ApiError(422, 'VALIDATION_FAILED', existing.error ?? 'Submission rejected.');
  }
  return {
    statusCode: 200,
    body: intakeResponseSchema.parse({
      data: { submissionId: existing.id, leadId: existing.leadId, duplicate: true, possibleDuplicateLeadIds: [] },
    }),
  };
}

async function storeRejected(
  apiKeyCtx: ApiKeyContext,
  idempotencyKey: string,
  rawBody: unknown,
  formType: string,
  errorMessage: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const submission = await tx.websiteSubmission.create({
      data: {
        organizationId: apiKeyCtx.organizationId,
        externalId: idempotencyKey,
        formType,
        payload: (rawBody ?? null) as Prisma.InputJsonValue,
        status: 'REJECTED',
        error: errorMessage,
      },
    });
    await writeIntakeAudit(tx, {
      action: 'intake.rejected',
      organizationId: apiKeyCtx.organizationId,
      submissionId: submission.id,
      apiKeyPrefix: apiKeyCtx.keyPrefix,
    });
  });
}

/**
 * Honeypot hit (D71): stored as SPAM, never REJECTED — REJECTED is reserved
 * for a genuine mapping failure. No Lead is created. The caller (below)
 * returns a 201 response byte-for-byte the same shape as a real success —
 * the sender is never told it was caught.
 */
async function storeSpam(
  apiKeyCtx: ApiKeyContext,
  idempotencyKey: string,
  rawBody: unknown,
  input: ReturnType<typeof websiteEnquiryIntakeSchema.parse>,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.websiteSubmission.create({
      data: {
        organizationId: apiKeyCtx.organizationId,
        externalId: idempotencyKey,
        formType: input.formType,
        submittedAt: input.submittedAt ? new Date(input.submittedAt) : null,
        sourcePage: input.sourcePage ?? null,
        payload: (rawBody ?? null) as Prisma.InputJsonValue,
        status: 'SPAM',
      },
    });
    await writeIntakeAudit(tx, {
      action: 'intake.spam',
      organizationId: apiKeyCtx.organizationId,
      submissionId: submission.id,
      apiKeyPrefix: apiKeyCtx.keyPrefix,
    });
    return submission.id;
  });
}

async function createLeadFromIntake(
  apiKeyCtx: ApiKeyContext,
  idempotencyKey: string,
  rawBody: unknown,
  input: ReturnType<typeof websiteEnquiryIntakeSchema.parse>,
): Promise<{ submissionId: string; leadId: string }> {
  const mapped = mapIntakeFields(input);

  return prisma.$transaction(async (tx) => {
    const source = await tx.leadSource.findFirst({
      where: { organizationId: apiKeyCtx.organizationId, name: 'Website' },
      select: { id: true },
    });
    if (!source) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'The Website lead source is not configured.');
    }

    const lead = await tx.lead.create({
      data: {
        organizationId: apiKeyCtx.organizationId,
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        email: mapped.email,
        emailNormalized: normalizeEmail(mapped.email),
        phone: mapped.phone,
        phoneNormalized: normalizePhone(mapped.phone),
        companyName: mapped.companyName,
        companyNameNormalized: normalizeCompanyName(mapped.companyName),
        website: mapped.website,
        industry: mapped.industry,
        sourceId: source.id,
        sourceDetail: mapped.sourceDetail,
        priority: 'MEDIUM',
        requirement: mapped.requirement,
        capturedFields: mapped.capturedFields as Prisma.InputJsonValue,
      },
    });

    const submission = await tx.websiteSubmission.create({
      data: {
        organizationId: apiKeyCtx.organizationId,
        externalId: idempotencyKey,
        formType: input.formType,
        submittedAt: input.submittedAt ? new Date(input.submittedAt) : null,
        sourcePage: input.sourcePage ?? null,
        payload: (rawBody ?? null) as Prisma.InputJsonValue,
        status: 'LEAD_CREATED',
        leadId: lead.id,
      },
    });

    await writeIntakeAudit(tx, {
      action: 'intake.lead_created',
      organizationId: apiKeyCtx.organizationId,
      submissionId: submission.id,
      apiKeyPrefix: apiKeyCtx.keyPrefix,
    });

    return { submissionId: submission.id, leadId: lead.id };
  });
}

/**
 * The full website intake flow. idempotencyKey is the raw Idempotency-Key
 * header value, already confirmed present by the caller (route layer).
 *
 * Ordering is deliberate and load-bearing (D71): the (organizationId,
 * externalId) lookup runs first, against the raw body, before
 * websiteEnquiryIntakeSchema.parse() is ever called — a repeat key must win
 * over body validation, even when the replayed body would itself fail
 * validation. Only once no existing row is found does real validation,
 * honeypot handling, field mapping, and Lead creation happen.
 */
export async function processWebsiteIntake(
  apiKeyCtx: ApiKeyContext,
  idempotencyKey: string,
  rawBody: unknown,
): Promise<IntakeOutcome> {
  const existing = await prisma.websiteSubmission.findUnique({
    where: { organizationId_externalId: { organizationId: apiKeyCtx.organizationId, externalId: idempotencyKey } },
  });
  if (existing) {
    return buildReplayOutcome(existing);
  }

  const parsed = websiteEnquiryIntakeSchema.safeParse(rawBody);
  if (!parsed.success) {
    const message =
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') ||
      'Invalid submission payload.';
    const formType =
      typeof (rawBody as Record<string, unknown> | null)?.formType === 'string'
        ? ((rawBody as Record<string, unknown>).formType as string)
        : 'unknown';
    await storeRejected(apiKeyCtx, idempotencyKey, rawBody, formType, message);
    throw new ApiError(422, 'VALIDATION_FAILED', message);
  }
  const input = parsed.data;

  if (input.hp && input.hp.trim().length > 0) {
    const submissionId = await storeSpam(apiKeyCtx, idempotencyKey, rawBody, input);
    return {
      statusCode: 201,
      body: intakeResponseSchema.parse({
        data: { submissionId, leadId: null, duplicate: false, possibleDuplicateLeadIds: [] },
      }),
    };
  }

  const mapped = mapIntakeFields(input);
  if (!mapped.email && !mapped.phone) {
    const message = 'The submission has no usable email or phone after field mapping.';
    await storeRejected(apiKeyCtx, idempotencyKey, rawBody, input.formType, message);
    throw new ApiError(422, 'VALIDATION_FAILED', message);
  }

  const { submissionId, leadId } = await createLeadFromIntake(apiKeyCtx, idempotencyKey, rawBody, input);

  // After commit, best-effort (PRD §11, D90): a failed notification must not
  // roll back — or fail the response for — a valid lead. Only a real new lead
  // notifies: replays, spam and rejections return earlier and never reach here.
  await notifyNewEnquiry(apiKeyCtx.organizationId, submissionId);

  // D71 / "already done": findDuplicateLeads now takes { orgId } rather than
  // a full RequestContext, so the intake path (no human user) can call it.
  const duplicates = await findDuplicateLeads(
    { orgId: apiKeyCtx.organizationId },
    {
      emailNormalized: normalizeEmail(mapped.email),
      phoneNormalized: normalizePhone(mapped.phone),
      companyNameNormalized: normalizeCompanyName(mapped.companyName),
    },
    { excludeId: leadId },
  );

  return {
    statusCode: 201,
    body: intakeResponseSchema.parse({
      data: { submissionId, leadId, duplicate: false, possibleDuplicateLeadIds: duplicates.map((d) => d.id) },
    }),
  };
}
