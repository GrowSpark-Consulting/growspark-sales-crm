// Deletes the incremental cache tsc --watch uses in dev mode (see "dev" and
// "dev:prepare" in package.json, and docs/decisions.md D24) before every
// `pnpm dev` run. Without this, the same stale-cache failure mode D12 found
// and fixed for the plain build could resurface here: if `dist` is ever
// deleted by hand while this file survives, tsc would wrongly believe dist
// is already current and skip writing it. Deleting it unconditionally,
// every time, means dev:prepare always does a real, trustworthy compile —
// the cost (a few milliseconds, three small files) is negligible.
import { rmSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const tsBuildInfoFile = fileURLToPath(new URL('../tsconfig.watch.tsbuildinfo', import.meta.url));
rmSync(tsBuildInfoFile, { force: true });
