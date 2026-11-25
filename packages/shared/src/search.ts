import { z } from 'zod';

/** Global search (Day 6a, D94). */

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
/** Results shown per group; the service asks for one more to know whether "See all" is worth offering. */
export const SEARCH_RESULTS_PER_GROUP = 5;

export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(SEARCH_MIN_LENGTH, `Type at least ${SEARCH_MIN_LENGTH} characters`)
    .max(SEARCH_MAX_LENGTH, `Search is limited to ${SEARCH_MAX_LENGTH} characters`),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const SEARCH_GROUP_TYPES = ['lead', 'contact', 'company', 'deal', 'quotation'] as const;
export const searchGroupTypeSchema = z.enum(SEARCH_GROUP_TYPES);
export type SearchGroupType = z.infer<typeof searchGroupTypeSchema>;

export const searchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** A short second line (company, email, stage…); may be empty. */
  subtitle: z.string(),
  href: z.string(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchGroupSchema = z.object({
  type: searchGroupTypeSchema,
  label: z.string(),
  results: z.array(searchResultSchema),
  /** More matches exist than are shown. */
  hasMore: z.boolean(),
  /** The record list filtered by the same text (`/leads?q=…`). */
  seeAllHref: z.string(),
});
export type SearchGroup = z.infer<typeof searchGroupSchema>;

/** Only groups the caller may read and that have at least one match are returned, in a fixed order. */
export const searchResponseSchema = z.object({
  data: z.object({
    query: z.string(),
    groups: z.array(searchGroupSchema),
  }),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
