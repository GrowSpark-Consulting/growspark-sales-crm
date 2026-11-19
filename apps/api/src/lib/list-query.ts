/**
 * The one bit of the Users module's list-query pattern (see
 * users.service.ts's listUsers) that was still being hand-written per
 * module: turning a validated `{ field, direction } | undefined` sort param
 * into a Prisma `orderBy`, falling back to a default when none was given.
 * Pairs with pagination.ts's toSkipTake/buildPaginationMeta, which already
 * covered the page/pageSize half of the same pattern. page/pageSize/sort
 * parsing and validation themselves stay in packages/shared's
 * pageQuerySchema/sortQuerySchema (per-resource field whitelist, unknown
 * field -> 422) — this is just the one line every service was repeating.
 */
export interface SortInput<SortField extends string> {
  field: SortField;
  direction: 'asc' | 'desc';
}

export function buildOrderBy<SortField extends string>(
  sort: SortInput<SortField> | undefined,
  fallback: SortInput<SortField>,
): Record<string, 'asc' | 'desc'> {
  const { field, direction } = sort ?? fallback;
  return { [field]: direction };
}
