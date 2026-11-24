import { runSetOrgDetails } from './lib/set-org-details.js';

// Local: writes to whatever DATABASE_URL apps/api/.env points at (crm_dev),
// loaded by `tsx --env-file=.env` in package.json. Run by the owner only.
const target = (() => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return `local database "${url.pathname.replace(/^\//, '')}" on ${url.hostname}`;
  } catch {
    return 'local database (DATABASE_URL unparsable)';
  }
})();

await runSetOrgDetails(process.argv.slice(2), target);
