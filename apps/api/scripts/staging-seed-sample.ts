import { loadStagingEnv } from './lib/load-staging-env.js';

if (!process.argv.includes('--confirm')) {
  console.error('This writes fictional sample data into the staging database.');
  console.error('Re-run with --confirm to proceed: pnpm staging:seed-sample -- --confirm');
  process.exit(1);
}

loadStagingEnv();

// Dynamic import, not a child process spawning `pnpm exec tsx ...` — that
// resolves to pnpm's .cmd shim on Windows, which Node 22 refuses to spawn
// without a shell (same ENOENT class of problem as staging-migrate.ts, see
// scripts/lib/run-cli.ts). db-seed-sample.ts's own top-level
// main().catch().finally() runs as a side effect of importing it — the
// exact same script local dev's `pnpm db:seed:sample` already runs,
// unchanged — using whatever loadStagingEnv() already put in process.env,
// the same "dynamic import after an env override" pattern tests/setup.ts
// already established (a static import here would be hoisted above
// loadStagingEnv() above).
await import('./db-seed-sample.js');
