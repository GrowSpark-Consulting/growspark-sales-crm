import { describe, expect, it, vi } from 'vitest';

const execFileSync = vi.fn();
vi.mock('node:child_process', () => ({ execFileSync: (...args: unknown[]) => execFileSync(...args) }));

describe('runPrismaCli', () => {
  it('spawns node directly against the resolved prisma CLI entry file, never "pnpm"/"prisma"/a shell', async () => {
    const { runPrismaCli } = await import('../../scripts/lib/run-cli.js');

    runPrismaCli(['migrate', 'deploy'], '/fake/cwd');

    expect(execFileSync).toHaveBeenCalledTimes(1);
    const [command, args, options] = execFileSync.mock.calls[0] as [string, string[], Record<string, unknown>];

    // The whole point: this must be the real node binary, never a string
    // like "pnpm" or "prisma" that Windows would have to resolve through a
    // .cmd shim (and a shell) to run at all.
    expect(command).toBe(process.execPath);
    expect(command).not.toMatch(/pnpm|prisma\.cmd/);

    // The resolved entry file comes before the CLI's own args.
    expect(args[0]).toMatch(/prisma[\\/].*build[\\/]index\.js$/);
    expect(args.slice(1)).toEqual(['migrate', 'deploy']);

    // No shell involved at all.
    expect(options).not.toHaveProperty('shell');
    expect(options).toMatchObject({ stdio: 'inherit', cwd: '/fake/cwd' });
  });
});
