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

## Notes

- `packages/shared` ships a compiled build. After changing its source, run
  `pnpm --filter @growspark/shared build` (or `pnpm build`) before the change is
  visible to `apps/web` / `apps/api`. See `docs/decisions.md` (D9).
- No database migrations yet — Prisma and schema work are out of scope for this
  package.
