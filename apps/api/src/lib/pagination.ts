export interface PageParams {
  page: number;
  pageSize: number;
}

export function toSkipTake({ page, pageSize }: PageParams): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginationMeta(
  { page, pageSize }: PageParams,
  total: number,
): { page: number; pageSize: number; total: number } {
  return { page, pageSize, total };
}
