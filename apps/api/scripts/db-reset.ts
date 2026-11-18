import { execFileSync } from 'node:child_process';

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env file present; rely on whatever is already in the environment.
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error('db:reset: DATABASE_URL is not set.');
  process.exit(1);
}

const url = new URL(rawUrl);
const host = url.hostname;
const databaseName = url.pathname.replace(/^\//, '');

console.log(`db:reset target -> host="${host}" database="${databaseName}"`);

const hostAllowed = host === 'localhost' || host === '127.0.0.1';
const nameAllowed = databaseName.endsWith('_dev') || databaseName.endsWith('_test');

if (!hostAllowed || !nameAllowed) {
  console.error(
    'db:reset: refusing. Host must be localhost/127.0.0.1 ' +
      `(got "${host}") and the database name must end in _dev or _test ` +
      `(got "${databaseName}").`,
  );
  process.exit(1);
}

execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force'], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url),
});
