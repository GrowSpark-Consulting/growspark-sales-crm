import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../env.js';
import { buildDatabasePoolConfig } from '../lib/database-ssl.js';

/**
 * The only `pg.Pool` in this app — `src/routes/health.ts`'s `/health/db`
 * raw query reuses this exact instance rather than building its own (it
 * used to, in a now-removed src/db/pool.ts, with neither the pool-size
 * limit nor any SSL config applied — see docs/decisions.md D68).
 */
export const pool = new Pool(buildDatabasePoolConfig(env));
// Unset in local dev/test — adapter-pg then uses the connection's own
// default schema, unchanged. Set to "sales" in staging via DATABASE_SCHEMA;
// this is the adapter's own `schema` option (generates schema-qualified
// SQL), not Prisma's multiSchema — see docs/decisions.md D58 for why that
// distinction matters and what else was tried first.
const adapter = new PrismaPg(pool, env.DATABASE_SCHEMA ? { schema: env.DATABASE_SCHEMA } : undefined);

export const prisma = new PrismaClient({ adapter });
