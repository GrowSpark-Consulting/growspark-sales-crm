import { z } from 'zod';

/** Mirrors the database's priority enum. See lead-statuses.ts for why this is a tuple, not a TS enum. */
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const prioritySchema = z.enum(PRIORITIES);
export type Priority = z.infer<typeof prioritySchema>;
