try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env file present; rely on whatever is already in the environment.
}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Dynamic imports, not static ones: a static `import` is hoisted above the
// DATABASE_URL override above, which would make src/env.ts (and the prisma
// singleton it feeds) capture the un-overridden crm_dev URL instead.
const { beforeEach } = await import('vitest');
const { resetDatabase } = await import('./helpers/reset-database.js');
const { resetLoginRateLimiters } = await import('../src/lib/rate-limit.js');

// Every test in every file starts from a known-empty database. Existing
// per-test cleanup (cleanupOrganization in afterEach hooks) still runs and
// stays harmless — this just adds a safety net for a test that throws before
// its own cleanup executes, so one test's leftover rows can never leak into
// the next.
beforeEach(resetDatabase);

// Same principle for the login rate limiters: they are in-memory module
// singletons, so without this, one test's login attempts would count
// towards another test's limit.
beforeEach(resetLoginRateLimiters);
