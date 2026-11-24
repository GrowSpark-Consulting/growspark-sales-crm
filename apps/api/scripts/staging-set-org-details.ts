import { loadStagingEnv } from './lib/load-staging-env.js';
import { runSetOrgDetails } from './lib/set-org-details.js';

// Staging: loadStagingEnv() prints the host and schema and refuses to run
// unless apps/api/.env.staging.local is present and consistent (D59/D62).
// runSetOrgDetails only imports the database client after this has run.
loadStagingEnv();
await runSetOrgDetails(process.argv.slice(2), `staging (schema ${process.env.DATABASE_SCHEMA ?? 'unset'})`);
