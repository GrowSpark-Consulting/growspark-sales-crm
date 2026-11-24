// Fails if any real .env-style file (anything but a *.example placeholder)
// would actually be copied into a Docker image built from this repo's root
// context — i.e. is still present after .dockerignore is applied.
//
// Why this exists, and why it asks Docker itself rather than re-implementing
// .dockerignore pattern matching in a script: a bare pattern like ".env" in
// .dockerignore only matches a file at the *context root* — unlike
// .gitignore, it is NOT recursive by default, and needs an explicit "**/"
// prefix to match at every depth. An earlier version of this repo's
// .dockerignore used bare patterns, and apps/api/.env (real local database
// credentials) plus apps/api/.env.staging.local (real staging credentials)
// were both actually baked into a built image as a result — found by
// inspecting a running container, not by reading the .dockerignore file and
// assuming it worked. See docs/decisions.md D79 for the full incident. A
// hand-written checker could make the exact same wrong assumption this one
// did; asking the real Docker build to apply the real .dockerignore cannot.
//
// Plain Node, no shell anywhere (host or container): every docker
// invocation here uses spawnSync('docker', [...argv]) — never execSync or
// shell: true — so there is no `.cmd`-shim/CVE-2024-27980-style resolution
// risk the way invoking `pnpm`/`npx` directly would have (see
// apps/api/scripts/lib/run-cli.ts for that exact problem and fix; `docker`
// itself is a real executable, not a shell-wrapped shim, so no
// process.execPath redirection is needed here the way it is there). This
// also avoids the original .sh version's dependency on a POSIX `sh` being
// on PATH at all, which plain Windows cmd/PowerShell don't guarantee.

import { spawnSync } from 'node:child_process';

const TAG = 'growspark-dockerignore-check:tmp';
const DOCKERFILE = 'FROM busybox\nWORKDIR /ctx\nCOPY . .\n';

function run(args, options = {}) {
  return spawnSync('docker', args, { encoding: 'utf8', ...options });
}

function cleanup() {
  run(['rmi', '-f', TAG]);
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function main() {
  const build = run(['build', '-q', '-f', '-', '-t', TAG, '.'], { input: DOCKERFILE });
  if (build.status !== 0) {
    fail(`FAIL: could not build the throwaway check image.\n${build.stderr || build.stdout}`);
    return;
  }

  // Passed as a real argv array to `docker run`, never through a shell —
  // find's own "(" / "-o" / ")" / "!" are literal arguments to find itself,
  // not shell syntax, so there is nothing for any shell to interpret or
  // mis-parse on either the host or the container side.
  const find = run([
    'run',
    '--rm',
    TAG,
    'find',
    '.',
    '(',
    '-name',
    '.env',
    '-o',
    '-name',
    '.env.*',
    ')',
    '!',
    '-name',
    '*.example',
    '-print',
  ]);

  if (find.status !== 0) {
    fail(`FAIL: could not inspect the built image's filesystem.\n${find.stderr}`);
    return;
  }

  const leaked = find.stdout.trim();
  if (leaked) {
    fail(
      'FAIL: real .env-style file(s) would be copied into a Docker image:\n' +
        leaked +
        '\nFix .dockerignore (every pattern needs a **/ prefix to match at any depth) before building.',
    );
    return;
  }

  console.log('OK: no real .env-style file is present in the Docker build context.');
}

try {
  main();
} finally {
  cleanup();
}
