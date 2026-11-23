import { execFileSync } from 'node:child_process';
import { loadStagingEnv } from './lib/load-staging-env.js';

loadStagingEnv();

execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url),
});
