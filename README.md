# Grow Spark Sales & CRM

Internal sales and CRM tool for Grow Spark Consulting. Admin and Staff users; leads,
companies, contacts, deals, pipeline, activities, dashboard.

This is package 1.1: scaffolding only. No product features yet.

## Stack

- `apps/web` — Next.js (App Router, TypeScript, Tailwind v4, shadcn/ui)
- `apps/api` — Express 5 (TypeScript ESM)
- `packages/shared` — Zod schemas and enums shared by both apps
- PostgreSQL 17, in Docker only (both apps run natively on Windows)

## Prerequisites

- Node.js >= 22.12 (developed against 22.20.0)
- pnpm 11.10.0 (`packageManager` field pins this; use corepack or install directly)
- Docker Desktop, running

## Quick start

```powershell
# 1. Install dependencies
pnpm install

# 2. Copy env files and fill in values (dev-only credentials are fine locally)
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env

# 3. Start Postgres (only Postgres runs in Docker)
pnpm db:up

# 4. Run both apps in dev mode
pnpm dev
```

- Web: http://localhost:3000 (shows live API health via the `/api/*` proxy)
- API: http://localhost:4000/health, http://localhost:4000/health/db,
  http://localhost:4000/api/v1/health

## Other scripts

| Script | What it does |
| --- | --- |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:logs` | Manage the Postgres container |
| `pnpm build` | Build all packages/apps (dependency-ordered) |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm lint` | ESLint across the workspace (flat config; `next lint` no longer exists) |
| `pnpm test` | Run tests across the workspace |
| `pnpm format` | Prettier, write mode |

## Troubleshooting

### Port already in use (Windows)

`pnpm dev` needs 3000 (web) and 4000 (api) free; `pnpm db:up` needs 5433. If one is
taken — often a leftover dev server from a previous session that didn't shut down
cleanly — find and stop it:

```powershell
# Find what's listening on a port (replace 3000 with 4000/5433 as needed)
netstat -ano | findstr :3000

# The last column is the PID. Inspect it before stopping anything, so you don't
# kill something unrelated that happens to be using the port:
Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" | Select-Object CommandLine

# If it's really a leftover dev server (next/tsx/tsc from this repo), stop it
# and its children:
taskkill /PID <PID> /T /F
```

`Stop-Process -Id <PID> -Force` works too if you prefer PowerShell idioms, but
`taskkill /T` is more reliable here because it kills the whole process tree —
`next dev` / `pnpm -r --parallel dev` spawn several child processes, and killing
only the top-level one can leave children (e.g. Next's `start-server.js` or a
Turbopack worker) running and still holding the port.

## Notes

- `pnpm dev` also runs `packages/shared` in `tsc --watch` mode, so editing its
  source rebuilds automatically and `apps/api`'s `tsx watch` picks up the change.
  Outside of `pnpm dev` (e.g. a one-off `pnpm --filter api typecheck`), the root
  `typecheck`/`lint`/`test`/`build` scripts all build `packages/shared` first
  automatically — see `docs/decisions.md` (D9, D12).
- No database migrations yet — Prisma and schema work are out of scope for this
  package.
