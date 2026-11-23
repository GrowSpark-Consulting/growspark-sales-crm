import { loadStagingEnv } from './lib/load-staging-env.js';

loadStagingEnv();

// Dynamic import, not a static one: it's hoisted above loadStagingEnv()
// above, which would make src/env.js (and the prisma/pool singletons it
// feeds) capture process.env before the staging file is loaded into it —
// the same reasoning as every other staging script.
const { prisma, pool } = await import('../src/db/prisma.js');
const { env } = await import('../src/env.js');

function safeHost(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '(unparsable DATABASE_URL)';
  }
}

async function main(): Promise<void> {
  console.log(`host: ${safeHost(env.DATABASE_URL)}`);
  console.log(`schema: ${env.DATABASE_SCHEMA ?? '(unset)'}`);

  // The exact same pool the API/Prisma use (src/db/prisma.ts, D68) — this
  // proves the real connection factory works, not a separately-built one
  // that might behave differently.
  await pool.query('SELECT 1');
  const count = await prisma.organization.count();

  console.log(`OK: SELECT 1 succeeded; ${count} organization(s) visible in this schema.`);
}

main()
  .catch((err: unknown) => {
    console.error(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
