import { z } from 'zod';

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

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
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
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
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
