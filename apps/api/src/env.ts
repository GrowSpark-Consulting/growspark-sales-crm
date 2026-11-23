import { z } from 'zod';
import { checkDatabaseSchemaConsistency, checkLocalDatabaseHost } from './lib/database-config-guards.js';

/**
 * Express's "trust proxy" setting accepts `false`, `true`, or a hop count
 * (number of proxies between the client and this process). We only ever
 * need "off" (direct connections, e.g. local dev) or a small hop count
 * (behind the Next.js rewrite proxy in front of this API), never the
 * string/subnet forms Express also supports — so the env var is just
 * "false" or a non-negative integer.
 */
const trustProxySchema = z
  .string()
  .default('false')
  .transform((value, ctx) => {
    if (value === 'false') return false as const;
    const hops = Number(value);
    if (!Number.isInteger(hops) || hops < 0) {
      ctx.addIssue({ code: 'custom', message: 'TRUST_PROXY must be "false" or a non-negative integer' });
      return z.NEVER;
    }
    return hops;
  });

/**
 * Plain "true"/"false" strings only — not z.coerce.boolean(), which coerces
 * via JS's `Boolean(value)` and would make the literal string "false" parse
 * as `true` (any non-empty string is truthy). That footgun matters
 * specifically here because this flag's whole purpose is to be exactly
 * "false" by default.
 */
const optionalBooleanFlagSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    ctx.addIssue({ code: 'custom', message: 'must be "true" or "false"' });
    return z.NEVER;
  });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    // Unset in local dev/test (the adapter targets whatever the connection's
    // default schema is, unchanged). Set to "sales" in staging, matching
    // DATABASE_URL's own ?schema= param — see docs/decisions.md D58 and the
    // checkDatabaseSchemaConsistency guard below for why both must agree.
    DATABASE_SCHEMA: z.string().min(1).optional(),
    // pg.Pool's own default (10) in local dev, unchanged. Staging sets this
    // to 5 — Supabase's free tier has few connections available.
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    // Unset in local dev (no TLS config passed to pg at all). A file path or
    // pasted PEM in staging verifies Supabase's certificate chain; see
    // src/lib/database-ssl.ts for the full behaviour and the insecure
    // DATABASE_SSL_REJECT_UNAUTHORIZED escape hatch.
    DATABASE_SSL_CA: z.string().min(1).optional(),
    DATABASE_SSL_REJECT_UNAUTHORIZED: optionalBooleanFlagSchema,
    ALLOWED_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      ),
    TRUST_PROXY: trustProxySchema,
    SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  })
  .superRefine((value, ctx) => {
    const schemaMismatch = checkDatabaseSchemaConsistency(value.DATABASE_URL, value.DATABASE_SCHEMA);
    if (schemaMismatch) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_SCHEMA'], message: schemaMismatch });
    }

    // Never applies to NODE_ENV=production (Render genuinely connects to
    // Supabase) or to the staging scripts (which load .env.staging.local
    // directly and never import this module at all).
    if (value.NODE_ENV !== 'production') {
      const nonLocalHost = checkLocalDatabaseHost(value.DATABASE_URL);
      if (nonLocalHost) {
        ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: nonLocalHost });
      }
    }
  });

/**
 * Exported separately from the process.exit-on-failure wrapper below so
 * tests can assert on validation behaviour (including the cross-field
 * guards above) without actually terminating the test process.
 */
export function parseEnv(raw: NodeJS.ProcessEnv) {
  return envSchema.safeParse(raw);
}

function loadEnv() {
  const result = parseEnv(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
