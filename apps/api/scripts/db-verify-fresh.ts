import { execFileSync } from 'node:child_process';

// Manual, human-run check that crm_test migrates cleanly from zero. NOT part
// of the automated test suite (`pnpm test`) — this drops and recreates the
// database, and Prisma's CLI itself refuses to run `migrate reset` when it
// detects an AI agent invoking it without the operator's explicit, in-the-
// moment consent. Run this yourself before a release: `pnpm db:verify-fresh`.

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env file present; rely on whatever is already in the environment.
}

const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl) {
  console.error('db:verify-fresh: TEST_DATABASE_URL is not set.');
  process.exit(1);
}

const url = new URL(rawUrl);
const host = url.hostname;
const databaseName = url.pathname.replace(/^\//, '');

console.log(`db:verify-fresh target -> host="${host}" database="${databaseName}"`);

const hostAllowed = host === 'localhost' || host === '127.0.0.1';
const nameAllowed = databaseName === 'crm_test';

if (!hostAllowed || !nameAllowed) {
  console.error(
    'db:verify-fresh: refusing. TEST_DATABASE_URL must point at a local crm_test ' +
      `database (host localhost/127.0.0.1, name exactly "crm_test"). Got host="${host}" ` +
      `database="${databaseName}".`,
  );
  process.exit(1);
}

console.log('db:verify-fresh: resetting crm_test and reapplying all migrations from zero...');

execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force'], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, DATABASE_URL: rawUrl },
});

console.log('db:verify-fresh: success — crm_test migrated cleanly from zero.');
