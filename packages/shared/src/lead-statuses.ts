import { z } from 'zod';

/**
 * Mirrors the database's lead_status enum (schema.prisma's LeadStatus).
 * A plain `as const` tuple + z.enum, not a TS `enum`, deliberately: Prisma's
 * own generated enum type is also a string-literal union with the same
 * values, so this is directly assignable to a Prisma field with no bridge
 * cast needed (unlike ROLES, which is a TS enum and does need one — see
 * apps/api/src/lib/context.ts's toSharedRole/toPrismaRole).
 */
export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED'] as const;
export const leadStatusSchema = z.enum(LEAD_STATUSES);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

/**
 * Every status except CONVERTED — D29: any open status may move to any
 * other open status directly; CONVERTED is reachable only through the
 * dedicated convert action (Day 3), never a plain status-field edit.
 */
export const OPEN_LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED'] as const;
export const openLeadStatusSchema = z.enum(OPEN_LEAD_STATUSES);
export type OpenLeadStatus = z.infer<typeof openLeadStatusSchema>;
