import type { Prisma } from '../generated/prisma/client.js';

/**
 * Real Postgres/Prisma error codes this app's Prisma 7 + `@prisma/adapter-pg`
 * setup surfaces — verified empirically (see docs/decisions.md D15): CHECK
 * violations come back as P2039 ("Database error"), not the classic-Prisma
 * P2004. Unique (P2002) and FK/RESTRICT (P2003) violations are unchanged
 * from classic Prisma. P2025 is Prisma's own "record not found".
 */
export const PRISMA_ERROR = {
  UNIQUE_VIOLATION: 'P2002',
  RECORD_NOT_FOUND: 'P2025',
  FK_VIOLATION: 'P2003',
  CHECK_VIOLATION: 'P2039',
} as const;

export function isKnownRequestError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return typeof err === 'object' && err !== null && 'code' in err && 'meta' in err;
}
