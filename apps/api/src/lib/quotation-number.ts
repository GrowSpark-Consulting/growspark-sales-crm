import type { Prisma } from '../generated/prisma/client.js';

/**
 * Allocates the next quotation number for an organisation and calendar year
 * (D83): "Q-2026-0001", restarting at 0001 every year.
 *
 * One atomic statement: INSERT ... ON CONFLICT DO UPDATE ... RETURNING. A
 * concurrent caller for the same (organisation, year) blocks on the
 * conflicting row's lock until the first transaction commits or rolls back,
 * then increments the committed value — so two simultaneous creates can never
 * receive the same number, and a rolled-back create releases its number
 * (gaps are possible only if a create fails after allocation, never
 * duplicates). Must be called inside the same transaction as the quotation
 * insert. The (organization_id, number) unique index is the second line of
 * defence. `updated_at` is supplied here because, like every timestamp in
 * this schema, it has no database default (PROJECT-STATE §8).
 */
export async function allocateQuotationNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
  year: number,
): Promise<string> {
  const [row] = await tx.$queryRaw<{ last_number: number }[]>`
    INSERT INTO quotation_counters (organization_id, year, last_number, updated_at)
    VALUES (${organizationId}::uuid, ${year}, 1, now())
    ON CONFLICT (organization_id, year)
    DO UPDATE SET last_number = quotation_counters.last_number + 1, updated_at = now()
    RETURNING last_number
  `;
  if (!row) {
    throw new Error('allocateQuotationNumber: the counter upsert returned no row');
  }
  return formatQuotationNumber(year, row.last_number);
}

export function formatQuotationNumber(year: number, sequence: number): string {
  return `Q-${year}-${String(sequence).padStart(4, '0')}`;
}
