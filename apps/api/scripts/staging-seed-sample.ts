import { execFileSync } from 'node:child_process';
import { loadStagingEnv } from './lib/load-staging-env.js';

if (!process.argv.includes('--confirm')) {
  console.error('This writes fictional sample data into the staging database.');
  console.error('Re-run with --confirm to proceed: pnpm staging:seed-sample -- --confirm');
  process.exit(1);
}

loadStagingEnv();

// Runs the exact same script local dev uses (pnpm db:seed:sample), unchanged
// — only the environment it inherits differs. Child processes inherit
// process.env by default, so the staging values loadStagingEnv() just loaded
// reach it without this script needing to know anything about its internals.
execFileSync('pnpm', ['exec', 'tsx', 'scripts/db-seed-sample.ts'], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url),
});
