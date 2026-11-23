import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);

/**
 * Runs the installed Prisma CLI in a child `node` process with no shell
 * involved at all — not `pnpm exec prisma` (or `execFileSync('pnpm', ...)`),
 * which resolves to pnpm's `.cmd` shim on Windows. Node 22 refuses to spawn
 * a `.cmd` file without an explicit shell (deliberate hardening against
 * CVE-2024-27980 — shell metacharacters in an argument could otherwise be
 * interpreted by the shell that resolving a `.cmd` file requires), so that
 * call fails with ENOENT before it ever reaches a database.
 *
 * Resolving the `prisma` package's own declared `bin` entry (its real JS
 * file, not the `pnpm`/`npx` wrapper) and invoking it with
 * `process.execPath` sidesteps the whole class of problem: `node.exe` is a
 * real executable, not a shell-dependent shim, so there is no shell to need
 * — or to inject into.
 */
export function runPrismaCli(args: string[], cwd: string | URL): void {
  const packageJsonPath = require.resolve('prisma/package.json');
  const bin = (require('prisma/package.json') as { bin?: Record<string, string> }).bin;
  const entryRelative = bin?.prisma;
  if (!entryRelative) {
    throw new Error('Could not resolve the installed "prisma" package\'s CLI entry point (its package.json has no bin.prisma).');
  }
  const entryPath = join(dirname(packageJsonPath), entryRelative);

  execFileSync(process.execPath, [entryPath, ...args], { stdio: 'inherit', cwd });
}
