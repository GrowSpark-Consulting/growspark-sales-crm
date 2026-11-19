import { z } from 'zod';

/** Every `:id` route param in this app is a UUID. */
export const idParamSchema = z.object({
  id: z.uuid('Invalid id'),
});
export type IdParam = z.infer<typeof idParamSchema>;

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export const paginationMetaSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});

/**
 * Builds a `sort` query param schema for one resource: `"<field>:asc"` or
 * `"<field>:desc"`, where `<field>` must be one of `fields` — the brief's
 * `sort=createdAt:desc` convention. Any other field name (or malformed
 * value) fails validation (422), by design: an unlisted sort field is
 * rejected, not silently ignored.
 */
export function sortQuerySchema<T extends readonly [string, ...string[]]>(fields: T) {
  return z
    .string()
    .refine((value) => /^[a-zA-Z]+:(asc|desc)$/.test(value), {
      message: 'sort must be in the form "<field>:asc" or "<field>:desc"',
    })
    .refine((value) => (fields as readonly string[]).includes(value.split(':')[0]!), {
      message: `sort field must be one of: ${fields.join(', ')}`,
    })
    .transform((value) => {
      const [field, direction] = value.split(':') as [T[number], 'asc' | 'desc'];
      return { field, direction };
    })
    .optional();
}

/** A query-string boolean ("true"/"false") — z.coerce.boolean() is wrong here: Boolean("false") is true. */
export const booleanQueryParam = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
