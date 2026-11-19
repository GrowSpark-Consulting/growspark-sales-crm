// Runs packages/shared, apps/api and apps/web's "dev" scripts concurrently,
// each as its own independent `pnpm --filter <pkg> run dev` child process.
//
// This deliberately does NOT use `pnpm -r --parallel dev`. Verified
// empirically (see docs/decisions.md D24): pnpm's own "-r --parallel"
// scheduler breaks apps/api's `tsx watch` — the child process starts, never
// logs anything (not even an error), and never binds its port. Reproduced
// with only apps/api in scope (no other package involved) and with only two
// packages, so it is not specific to any particular combination or count.
// Two independently-spawned `pnpm --filter <pkg> run dev` processes (what
// this script does, exactly as if a developer opened two terminal tabs) do
// not exhibit the problem at all.
import { spawn, spawnSync } from 'node:child_process';
import readline from 'node:readline';
import process from 'node:process';

const PACKAGES = [
  { name: 'packages/shared', filter: '@growspark/shared' },
  { name: 'apps/api', filter: 'api' },
  { name: 'apps/web', filter: 'web' },
];

function forwardLines(stream, out, label) {
  readline.createInterface({ input: stream }).on('line', (line) => {
    out.write(`${label}: ${line}\n`);
  });
}

function spawnDev({ name, filter }) {
  const label = `${name} dev`;
  const child = spawn('pnpm', ['--filter', filter, 'run', 'dev'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    windowsHide: true,
  });
  forwardLines(child.stdout, process.stdout, label);
  forwardLines(child.stderr, process.stderr, label);
  return { name, child };
}

const children = PACKAGES.map(spawnDev);
let shuttingDown = false;

/**
 * `pnpm --filter X run dev` spawns its own child(ren) in turn (tsx watch
 * spawns the actual api process; next dev spawns a start-server.js child),
 * so a plain child.kill() on the top-level pnpm process would not reliably
 * stop the whole tree on Windows. `taskkill /T` does.
 */
function killTree(pid) {
  try {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    // best-effort cleanup; nothing more to do if taskkill itself is unavailable
  }
}

function shutdown(code) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const { child } of children) {
    if (child.pid) {
      killTree(child.pid);
    }
  }
  process.exitCode = code;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

for (const { name, child } of children) {
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[dev] ${name} exited unexpectedly (code ${code}) — stopping the rest`);
      shutdown(code ?? 1);
    }
  });
}
