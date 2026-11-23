import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../env.js';
import { resolveDatabaseSsl } from '../lib/database-ssl.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  ssl: resolveDatabaseSsl(env),
});
// Unset in local dev/test — adapter-pg then uses the connection's own
// default schema, unchanged. Set to "sales" in staging via DATABASE_SCHEMA;
// this is the adapter's own `schema` option (generates schema-qualified
// SQL), not Prisma's multiSchema — see docs/decisions.md D58 for why that
// distinction matters and what else was tried first.
const adapter = new PrismaPg(pool, env.DATABASE_SCHEMA ? { schema: env.DATABASE_SCHEMA } : undefined);

export const prisma = new PrismaClient({ adapter });
