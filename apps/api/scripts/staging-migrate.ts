import { loadStagingEnv } from './lib/load-staging-env.js';
import { runPrismaCli } from './lib/run-cli.js';

loadStagingEnv();

runPrismaCli(['migrate', 'deploy'], new URL('..', import.meta.url));
