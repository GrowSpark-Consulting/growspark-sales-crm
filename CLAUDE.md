# CLAUDE.md

Working rules for this repository (Sales & CRM for Grow Spark Consulting).

## Stack

pnpm workspaces: `apps/web` (Next.js App Router, TypeScript, Tailwind v4, shadcn/ui),
`apps/api` (Express 5, TypeScript ESM, Zod, pino, helmet), `packages/shared`
(Zod schemas and enums, compiled via `tsc` — see `docs/decisions.md` D9).
PostgreSQL 17 runs only in Docker; both apps run natively on Windows. Single developer,
nothing reviewed by anyone else — correctness over speed.

## Code rules

- TypeScript strict everywhere. Zod schemas in `packages/shared` are the single source
  of validation — do not re-declare the same shape elsewhere.
- Controllers stay thin; business rules live in services that take a context
  `{ userId, orgId, role }`.
- Every query is scoped by `organisationId`; every route declares a required
  permission; no business logic in the frontend.
- Multi-table writes use a transaction; audit rows are written inside that same
  transaction.
- Read an existing module before writing a similar one; reuse shared helpers instead
  of duplicating them.

## Process rules

- Do not add a dependency, run a global install, or run destructive commands
  (`rm -rf`, `Remove-Item -Recurse`, `git reset --hard`, `git clean`,
  `docker volume rm`, `docker compose down -v`) without asking first.
- Do not start work outside the current package/step. Never `git push`.
- Before using any Next.js, Prisma, or Tailwind API, check the documentation for the
  **installed** major version — behavior differs from older examples.
- Commit locally after each logical unit of work with a clear message. Do not push.
- Pin exact dependency versions and record why in `docs/decisions.md` when the choice
  isn't obvious.
