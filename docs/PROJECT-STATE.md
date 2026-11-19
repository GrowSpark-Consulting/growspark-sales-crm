# Project State — Session Handover

A new session should start at `docs/NEXT-SESSION-START.md`, which reads this
file next, together with `CLAUDE.md` and `docs/decisions.md`. This file is
append-only in its Session Log (§15); every other section should be kept
accurate as reality changes, not just added to.

## 1. Project snapshot

**Sales & CRM** for Grow Spark Consulting: an internal tool for Admin and Staff
users covering the lead-to-deal flow (leads → companies/contacts → deals →
pipeline → activities → dashboard). Per the user, this CRM is **one of three
independent apps being built by different people** — stated directly, not
independently verifiable from this repo. The user's plan is **7 days**: Days
1–5 build, Day 6 testing, Day 7 stabilise and demo (also stated directly; see
§13 for what's known about Day 1's remaining packages and §14 for what isn't
known about Days 2–5).

**Current status (end of 2026-11-19 session)**: **Day 1 is functionally
complete.** Packages 1.1 through 1.7 are all built, tested, and committed
locally (not yet pushed). The full sales-journey-adjacent foundation exists:
server-side session auth, the full permission map, user management with the
last-Admin rule and audit log, and a working browser UI (login, role-aware
navigation, a Users page with create/edit/deactivate/reactivate/reset-
password, a 403 page, a 404 page) all exist and are wired together, now
restyled end to end with the Grow Spark Workspace design system (tokens,
fonts, Light/Dark/System theming, a rebuilt sidebar/top-bar shell), with a
reusable search box pattern and a real session-expiry-while-open flow
(global 401 handling, window-focus + route-change revalidation of `/auth/
me`) on top — login through the real browser-facing proxy on :3000 was
verified with curl (no browser available in this environment), and a full
manual click-through script (`docs/MANUAL-TEST-DAY1.md`, now including
design-system and session-expiry sections) is ready for the user to run in
a real browser, which this session could not do itself.

## 2. Hard constraints

- **(a) Grow Spark website repository**: must not be touched, read, or looked
  for. Website integration is **on hold** until this CRM is finished. When
  resumed, it must be purely additive: it must never affect the existing
  website's workflow, Supabase, SMTP, HubSpot, validation, spam protection, or
  visitor behaviour. **Now written into `CLAUDE.md`** (added in package
  1.2c) — no longer only in chat history and this file.
- **(b) Never push.** Commit locally only, always. No session has run
  `git push`.
- **(c) Never cut**: the essential sales journey, authentication, backend
  authorisation, data integrity, or core relationships — even under time
  pressure in later days.
- **(d) Dummy data only** — no real customer, lead, or company data, ever.

## 3. Working agreement

- One work package per prompt. Inspect existing code before writing similar
  code. Stop at review gates (e.g. package 1.2 had a schema-approval gate
  between Phase A and Phase B).
- Reports use the standard 8-section format (what was built; commands run and
  actual output; tests added; deviations; dependencies added; known gaps;
  questions; next step) — except pure-docs tasks like this one, which use
  whatever short format the user asks for.
- Ask before: adding a dependency, running a destructive command, deleting a
  Docker volume, or running `git reset --hard` (or similar).
- **Process hygiene**: record the PID of anything started (dev servers,
  background scripts); stop it by exact PID with `taskkill /PID <pid> /T /F`
  (not a broad pattern match — `pkill -f` style matching has failed silently
  before, see §10); before finishing, prove ports 3000 and 4000 are clear via
  `netstat -ano | findstr :3000` (and `:4000`).
- **Prisma consent gate**: Prisma 7's CLI itself detects when it's invoked by
  an AI agent and refuses destructive commands (`migrate reset`, likely others
  in the same family) without the human's explicit, in-the-moment consent —
  this is Prisma's own built-in safety check, not something this project
  configured. The human decides, every time; a prior message earlier in a
  conversation does not count as consent for a later invocation. The only
  databases this should ever be used on are `crm_test` and `crm_dev` (never
  anything else). See §10 and `docs/decisions.md` D15 for what happened the
  one time this was invoked (one-time manual consent, verification only — not
  wired into any automated script).

## 4. Environment

- Windows 10, PowerShell used for most commands this session (the user's own
  prompts reference `cmd`/PowerShell interchangeably; verify which the user
  has open before assuming syntax).
- Node **v22.20.0**, pnpm **11.10.0**, Docker **29.8.2** (Docker Desktop) —
  confirmed via `node -v` / `pnpm -v` / `docker --version` this session.
- Ports: web **3000**, API **4000**, Postgres **127.0.0.1:5433** (bound to
  localhost only, not `0.0.0.0`). Databases: **crm_dev**, **crm_test**, in one
  Postgres 17 container (`growspark-sales-crm-postgres`).

### Environment variables (names only — never commit or paste real values)

`apps/api/.env` (copy from `apps/api/.env.example`, which already holds
placeholder dev-only values, not secrets):

- `NODE_ENV`, `PORT` — standard.
- `DATABASE_URL`, `TEST_DATABASE_URL` — Postgres connection strings for
  `crm_dev` and `crm_test` respectively.
- `ALLOWED_ORIGINS` — comma-separated origin allow-list for the CSRF
  Content-Type/Origin check (D20); the web app's own origin.
- `TRUST_PROXY` — `"false"` locally; a hop-count integer once a real
  reverse proxy sits in front (see D21/D23, still deferred).
- `SESSION_TTL_DAYS` — sliding session expiry window.
- `SEED_ADMIN_PASSWORD`, `SEED_STAFF_PASSWORD` — dev-only; the seed has no
  built-in default and refuses to run without both set.

`apps/web/.env` (copy from `apps/web/.env.example`):

- `API_INTERNAL_URL` — server-side only, used by `next.config.ts` to build
  the `/api/*` rewrite proxy.

### Starting everything from scratch

Commands taken verbatim from the real root `package.json` (verified this
session):

```powershell
pnpm install                                    # also runs "prepare": builds
                                                 # packages/shared + prisma generate
copy apps\api\.env.example apps\api\.env        # fill in real values; see note below
copy apps\web\.env.example apps\web\.env
pnpm db:up                                       # starts Postgres only
pnpm db:migrate                                  # applies migrations to DATABASE_URL (crm_dev)
pnpm db:seed                                     # idempotent — safe to re-run
pnpm dev                                         # web:3000, api:4000, shared watch
```

`apps/api/.env.example` also needs `SEED_ADMIN_PASSWORD` /
`SEED_STAFF_PASSWORD` filled in (dev-only values are fine) before `db:seed`
will run — the seed has no password default in code.

**`pnpm dev` no longer runs `pnpm -r --parallel dev` internally** (package
1.3b, D24) — it runs `node scripts/dev.mjs`, which spawns `packages/shared`,
`apps/api`, and `apps/web`'s own `dev` scripts as three independent `pnpm
--filter <pkg> run dev` processes. `pnpm -r --parallel dev` itself was found
to hang `apps/api`'s `tsx watch` with zero output, unrelated to any specific
package or timing — do not revert to it. Verified 5 clean cold-state runs in
both package 1.3b and again in this session (re-verification after the
review gate): ports 3000/4000 free before each, both answering within
10–32s each time, ports free after each `taskkill /PID <top-level pnpm dev
PID> /T /F`.

**Docker Desktop is not always already running** at session start on this
machine — `docker info` can fail with a plain connection error. Launch it
via `Start-Process "shell:AppsFolder\Docker.DockerForWindows.Settings"` (the
`.exe` is not at the path you'd expect; found via `Get-StartApps`), then poll
`docker info` until it succeeds (took ~5s once, in this session).

### Troubleshooting

- **Port already in use**: see the "Port already in use (Windows)" section in
  the root `README.md` — `netstat -ano | findstr :3000`, inspect the PID
  before touching it, `taskkill /PID <pid> /T /F`.
- **Docker not running**: `docker info` fails fast with a clear connection
  error; start Docker Desktop and retry `pnpm db:up`.
- **PowerShell execution policy**: not hit this session (no `.ps1` scripts are
  used — all scripts are `pnpm`/`tsx`/node), but if it ever blocks something,
  that's a machine-level policy, not a repo config issue.
- **git pager**: commands in this session were run non-interactively; if a
  pager ever hangs a command, add `--no-pager` or pipe through `cat`.

## 5. Repository map

```
apps/web/              Next.js 16 App Router app (port 3000) — package 1.5,
                        restyled with the Grow Spark design system in 1.6
  app/
    layout.tsx            root layout — next/font (Inter + JetBrains Mono,
                        400/500/600 only), suppressHydrationWarning on
                        <html> (next-themes sets data-theme/style on it
                        after mount — D27)
    globals.css           imports design-tokens.css once; @theme inline
                        maps every shadcn semantic colour to a GS token;
                        global :focus-visible outline rule; reduced-motion
                        reset (D27)
    design-tokens.css     verbatim copy of docs/design-system/tokens.css —
                        edit the source and re-copy, never this file
                        directly (D27)
    providers.tsx         QueryClientProvider + next-themes ThemeProvider
                        (attribute="data-theme", defaultTheme="system",
                        enableSystem — the toggle lives in AppShell's user
                        menu, D27) + SessionExpiryHandler (D28), mounted
                        inside both providers
    not-found.tsx         404 page (Next's own file convention)
    login/page.tsx         public; wraps LoginForm in <Suspense> (needed for
                        useSearchParams) with a real skeleton fallback, not
                        null (D26); control-lg (44px) inputs/button (D27)
    (protected)/           route group, no URL segment; EVERY authenticated
                        page lives here behind one layout
      layout.tsx            AuthGuard (client-side nav convenience only,
                        never the real security control — D26) + AppShell;
                        `export const instant = false` (D28 — Cache
                        Components' instant-navigation dev validation;
                        can't be set on users/page.tsx itself, a Client
                        Component, so it's set once here instead)
      page.tsx              Home — plain placeholder; no own <h1> (the top
                        bar carries the page title — D27)
      forbidden/page.tsx     403 page; same, no own <h1>
      users/page.tsx         the Users page (see below); search box is now
                        SearchInput, not Input+Button (D28)
  components/
    auth-guard.tsx          useMe()-driven redirect: unauth'd -> /login?
                        next=..., shows a Skeleton while loading; also
                        invalidates the `me` query on every pathname change
                        after first mount, so a deactivated user is caught
                        on their next navigation (D28)
    session-expiry-handler.tsx  mounted once in providers.tsx; registers
                        api-client's onUnauthorized listener — on any 401,
                        clears the whole query cache and redirects to
                        /login?next=<path>, guarded against redirect loops
                        and against firing on /login's own failed-login 401
                        (D28)
    app-shell.tsx           rebuilt per the design system (D27): 240px dark
                        sidebar with the Sales product chip, 56px top bar
                        showing the current page's title (a flat pathname
                        lookup, PAGE_TITLES — fine for 3 routes, revisit
                        later), user menu with Light/Dark/System
                        (DropdownMenuRadioGroup) + logout
    login-form.tsx          React Hook Form + loginSchema (shared), inline
                        field errors, generic failure banner
    ui/                    shadcn: button, input, label, form, table,
                        dialog, dropdown-menu, badge, sonner, skeleton,
                        select, alert (1.5), tabs (1.6, added from the
                        already-installed radix-ui package, no new
                        dependency) — button/input/label/badge/alert/table/
                        tabs restyled per their design-system READMEs in
                        1.6 (D27); dialog's overlay fixed from `bg-black/50`
                        to `bg-ink/40` (the one other hard-coded colour
                        found); search-input.tsx (1.7, D28) — magnifier +
                        clear-x search box wrapping Input, reusable by
                        Leads/Companies/Contacts later
    users/                 create-user-dialog.tsx, edit-user-dialog.tsx,
                        reset-password-dialog.tsx, confirm-action-dialog.tsx
                        (generic, used for both deactivate and reactivate)
  hooks/
    use-me.ts              useMe() — GET /auth/me via TanStack Query,
                        retry:false (so a 401 settles fast, not after
                        retries); refetchOnWindowFocus:true, the one
                        exception to the QueryClient's app-wide default of
                        false (D28)
    use-users.ts            useUsersList(params) — server-side page/pageSize/
                        q/role/isActive, placeholderData keeps the old page
                        visible while a new one loads
  lib/
    api-client.ts           ApiError + apiGet/apiPost/apiPatch, same-origin
                        credentials; onUnauthorized(listener) — apiFetch
                        calls the registered listener on every 401,
                        regardless of caller (D28)
    handle-form-error.ts    the one place that decides: 422 -> field errors,
                        409/401/403 -> inline banner, 500/network -> toast
                        with request id (D26)
    format.ts               formatINR/formatINRCompact/formatDate/formatTime
                        — Indian grouping + L/Cr compaction, "19 Nov 2026",
                        "2:30 PM" (D27)
  tests/lib/
    format.test.ts          12 unit tests for lib/format.ts (D27)
    api-client.test.ts      4 unit tests for onUnauthorized (mocked fetch,
                        no DOM needed) (D28)
  vitest.config.mts       `.mts` (not `.ts` — avoids a Vite native-loader
                        ESM/CJS warning); one alias (`@` -> package root)
                        mirroring tsconfig.json (D27)
  next.config.ts         proxies /api/:path* to API_INTERNAL_URL; transpiles
                        @growspark/shared

apps/api/               Express 5 app (port 4000)
  src/
    app.ts              createApp({ extraRoutes? }) — Express app factory
                        (testable without listening); mounts helmet,
                        requestId, requestLog, enforceOriginAndContentType,
                        express.json(), then every module's routes, then
                        errorHandler last
    index.ts            entry point — calls app.ts, listens
    env.ts              Zod-validated env config: DATABASE_URL,
                        ALLOWED_ORIGINS, TRUST_PROXY, SESSION_TTL_DAYS, PORT,
                        NODE_ENV
    logger.ts            pino logger; silent when NODE_ENV=test (D22)
    db/pool.ts           raw pg Pool, used only by the /health/db check
    db/prisma.ts         PrismaClient singleton, built with @prisma/adapter-pg
    lib/                 context.ts (RequestContext, toSharedRole/
                        toPrismaRole), scoped.ts, password.ts (argon2id +
                        dummy-hash timing defence, D17), cookies.ts (cookie@2
                        stringifySetCookie/parseCookie, D16), session.ts
                        (create/find/touch/delete, sliding 7-day expiry),
                        audit.ts (writeAudit, tx-scoped), prisma-errors.ts
                        (PRISMA_ERROR codes + isKnownRequestError — single
                        source, also used by tests/schema/helpers.ts),
                        rate-limit.ts (loginEmailRateLimiter,
                        createGlobalLoginFloodLimiter factory, D23),
                        route-registry.ts (defineRoute — the one place every
                        route is declared; getRegisteredRoutes for the audit
                        test), pagination.ts (toSkipTake/buildPaginationMeta)
    middleware/          request-id.ts, request-log.ts, error-handler.ts
                        (ApiError + ZodError/body-parser/Prisma mapping),
                        session.ts (attachSessionContext), csrf.ts
                        (enforceOriginAndContentType — Origin allow-list +
                        JSON-only-when-body-present, D20), validate.ts
                        (validateRequest — body/params overwrite req.*,
                        query goes to req.validatedQuery since Express 5's
                        req.query has no setter, D19)
    modules/
      auth/               auth.service.ts, auth.routes.ts — POST
                        /auth/login,/logout, GET /auth/me, POST
                        /auth/change-password
      users/              users.service.ts, users.routes.ts — GET/POST
                        /users, GET/PATCH /users/:id, POST
                        /users/:id/{deactivate,reactivate,reset-password};
                        last-Admin rule via a raw SELECT...FOR UPDATE
                        (assertNotLastActiveAdmin)
      audit/              audit.service.ts, audit.routes.ts — GET
                        /audit-events
    routes/health.ts     GET /health, /health/db, mirrored at /api/v1/* — now
                        registered via defineRoute too (auth: 'public'), so
                        the route-registry audit covers it like every other
                        route
    types/express.d.ts   Request.id/.log/.ctx/.validatedQuery augmentation
  prisma/
    schema.prisma         full P0 data model (18 models, 8 enums)
    prisma.config.ts      (actually at apps/api/prisma.config.ts, not under prisma/)
    seed.ts / seed-lib.ts CLI entry + reusable runSeed(), idempotent
    SCHEMA-SUMMARY.md     factual per-model column/index/FK/CHECK reference —
                        read this instead of schema.prisma when you just need
                        to know what a table looks like
    migrations/           one migration, 20261118202744_init, NOT a Phase-A
                        artifact — see §7
  scripts/
    db-reset.ts           safety-checked wrapper for `prisma migrate reset`
                        (refuses unless host is localhost/127.0.0.1 and db
                        name ends _dev/_test)
    db-verify-fresh.ts    manual, human-run check that crm_test migrates
                        cleanly from zero — NOT part of `pnpm test`
  tsconfig.check.json     widened typecheck (tests/, prisma/*.ts, scripts/,
                        not just src/) — wired into the `typecheck` script
                        (package 1.2c)
  tests/
    health.test.ts, health-db.test.ts   pre-existing health-check tests
    schema/               11 files proving the DATABASE itself rejects bad
                        data (not application-level validation) — helpers.ts
                        re-exports PG_ERROR/isKnownRequestError from
                        src/lib/prisma-errors.ts (single source, package 1.3)
    helpers/              reset-database.ts (TRUNCATE all tables, refuses
                        unless the db name ends `_test`; global beforeEach in
                        setup.ts), tenant.ts (createTestTenant/
                        createTwoTestTenants — real argon2id users, known
                        passwords), http.ts (ALLOWED_ORIGIN,
                        sessionCookieHeader), route-audit.ts (walks the real
                        Express 5 route tree — app.router.stack + rawPath,
                        D19 — and diffs it against the registry)
    auth/, users/, audit/, lib/, middleware/, shared/   one directory per
                        concern added in 1.3/1.3b/1.4 — see §7 for what each
                        proves; 33 test files, 124 tests total as of 1.4

packages/shared/        Zod schemas + enums, consumed as a compiled package
  src/roles.ts           ROLES enum
  src/health.ts          health response Zod schema
  src/loss-reasons.ts    LOSS_REASONS constant + Zod enum (package 1.2)
  src/permissions.ts     PERMISSIONS map, ROLE_PERMISSIONS, hasPermission (1.3)
  src/auth.ts            loginSchema, changePasswordSchema, meResponseSchema (1.3)
  src/common.ts          idParamSchema, pageQuerySchema, sortQuerySchema
                        factory, booleanQueryParam (NOT z.coerce.boolean() —
                        see §10) (1.4)
  src/users.ts           create/update/resetPassword/listQuery/response
                        schemas for the users module (1.4)
  src/audit.ts           listAuditEventsQuerySchema, auditEventResponseSchema (1.4)
  tsconfig.watch.json     incremental build config used only by `dev`/
                        `dev:prepare` (package 1.3b, D24) — tsconfig.json
                        (build/typecheck) stays non-incremental per D12
  scripts/clean-watch-cache.mjs   deletes tsconfig.watch.tsbuildinfo before
                        every `dev:prepare`, so that cache can never go stale
                        the way D12's did

scripts/dev.mjs          root-level orchestrator replacing `pnpm -r
                        --parallel dev` (package 1.3b, D24) — see the `pnpm
                        dev` note in §4

docker-compose.yml       postgres:17-alpine only; project name
                        growspark-sales-crm, named volume, 127.0.0.1:5433 only
docker/init-db.sh        creates crm_test (crm_dev comes from POSTGRES_DB)

docs/
  NEXT-SESSION-START.md   the first file a fresh session reads — brief,
                        hard rules, reading order, the Day 2 plan, open items
  decisions.md           D1–D29 (see §9)
  PROJECT-STATE.md        this file
  DAY-1-SUMMARY.md        what was built/verified per package 1.1–1.7, bugs
                        found and fixed, "how to run the app and log in"
  MANUAL-TEST-DAY1.md     15-section browser click-through script (package
                        1.5, extended in 1.6/1.7) — not yet run by anyone,
                        this environment has no browser (§14)
  design-system/          the Grow Spark Workspace design system handed to
                        this session (README.md, tokens.css, tokens.json,
                        manifest.json, api/, components/*/README.md +
                        preview.html, components/bundle.css) — source of
                        truth for package 1.6, read-only reference, not
                        copied wholesale into apps/web (only tokens.css is
                        copied verbatim, into apps/web/app/design-tokens.css)
```

## 6. Stack and exact pinned versions

Read directly from the three `package.json` files this session (all workspace
packages pin exact versions, no `^`/`~` ranges, per `CLAUDE.md`).

| Area | Package | Version | Note |
|---|---|---|---|
| Root/all | `typescript` | **6.0.3** | Pinned below npm "latest" (**7.0.2**, the new Go-native rewrite) — `typescript-eslint@8.73.0`'s peer dependency caps support at `<6.1.0`. Revisit once typescript-eslint supports TS 7. |
| Root/all | `eslint` | 10.15.0 | |
| apps/api | `prisma`, `@prisma/client`, `@prisma/adapter-pg` | **7.10.1** | Pinned below npm "latest" for the `prisma` CLI package specifically (**8.0.0-rc.34** — a pre-release; `@prisma/client`'s own "latest" tag is correctly 7.10.1, so this is a real tag mismatch between the two packages, not a mistake on our part). |
| apps/api | `express` | 5.3.0 | |
| apps/api | `@node-rs/argon2` | 2.2.2 | Password hashing, default algorithm Argon2id |
| apps/api | `pg` | 8.23.1 | |
| apps/api | `cookie` | 2.0.2 | Session cookie serialize/parse. v2 renamed `serialize`/`parse` to `stringifySetCookie`/`parseCookie` (D16) |
| apps/api | `express-rate-limit` | 8.7.5 | Login rate limiting (D16, redesigned in D23) |
| apps/api | `vitest` / `supertest` | 5.1.1 / 7.3.2 | |
| apps/web | `next` | 16.4.6 | `next lint` was removed in 16.0.0; ESLint runs directly |
| apps/web | `react` / `react-dom` | 19.3.1 | |
| apps/web | `tailwindcss` | 4.3.5 | |
| apps/web | `shadcn` (CLI, dev) | 4.23.0 | |
| apps/web | `cn`, `radix-ui`, `class-variance-authority` | 0.5.2, 1.8.1, 0.7.1 | What the installed shadcn CLI actually generates now — verified live, not assumed; see `decisions.md` D11 |
| apps/web | `@tanstack/react-query` | 5.108.0 | |
| apps/web | `react-hook-form`, `@hookform/resolvers` | 7.92.0, 7.0.7 | Package 1.5. CLI-added with `^` ranges, re-pinned exact (D26) |
| apps/web | `sonner`, `next-themes` | 2.0.8, 0.4.6 | Package 1.5, same re-pin story. `next-themes` only exists for Sonner's `useTheme()` call — no theme toggle built (D26) |
| apps/web | `lucide-react` | 1.76.0 | Package 1.5 — the shadcn CLI referenced it in 4 components but didn't actually install it (D26) |
| apps/web | `vitest` | 5.1.1 | Package 1.6 — added (with explicit sign-off) so `lib/format.ts` could ship with real unit tests; same pinned version as `apps/api` (D27) |
| packages/shared | `zod` | 4.6.7 | |

## 7. What has been built, package by package

All commits are **local only from this tool's side** — no session run from
this tool has ever executed `git push`. **The "local matches origin" mystery
has now recurred twice**, not once: first noted around package 1.4/1.5 ("9
commits ahead of origin/main" resolving itself), and again at the start of
the end-of-Day-1 docs handover session (2026-11-19, after packages 1.6 and
1.7), when `git status` showed `main` already "up to date with
origin/main" — for commits this tool made locally and never pushed. Something outside these
sessions (the user directly, an IDE auto-sync feature, a git hook — not
established which) is pushing independently. Not a risk to flag loudly, but
stop assuming "local only" means "not on the remote": verify with
`git status`/`git log origin/main` if it matters for a given task.

- **Package 1.1 — scaffold** (`00269d5` … `e3b5c78`, 6 commits): pnpm
  workspace root tooling; Postgres 17 docker-compose; `packages/shared`
  (ROLES, health schema); `apps/api` (Express 5, health endpoints); `apps/web`
  (Next.js 16, Tailwind v4, shadcn Button); decisions log + CLAUDE.md +
  README.
- **Package 1.1b — verification & hardening** (`b6a60e8`, `5f3ef1d`, 2
  commits): fixed a stale-`.tsbuildinfo` bug that could let `packages/shared`
  silently fail to rebuild; verified the `cn`/`radix-ui` dependencies are
  genuinely what shadcn's CLI generates; added Windows process-hygiene
  guidance to the README.
- **Package 1.2 — Prisma schema, migration, seed** (`6d89974` … `107300d`,
  9 commits): full P0 schema (18 models), one migration (schema-approved with
  amendments before being applied), idempotent seed, 17 new tests proving the
  database rejects bad data. Full detail in `docs/decisions.md` D13–D15 and
  §8 below.
- **Package 1.2c — housekeeping** (`307e373`): widened typecheck
  (`tsconfig.check.json`) to cover `tests/`/`prisma/*.ts`/`scripts/`;
  refreshed the stale README; added the website-repo rule to `CLAUDE.md`;
  added `resetDatabase()` (TRUNCATE, guarded to `_test`-suffixed databases)
  and `createTestTenant()`/`createTwoTestTenants()` ahead of package 1.3
  needing them.
- **Package 1.3 — API core, sessions, auth, permissions** (`c095a9c`):
  server-side sessions (opaque token, SHA-256 hash stored, sliding 7-day
  expiry), argon2id passwords with a login timing defence, the permission
  map (`PERMISSIONS`/`ROLE_PERMISSIONS`/`hasPermission`), the route registry
  (`defineRoute` — every route declares `'public'`/`'authenticated'`/a
  permission; a test audits the live Express route tree against it), the
  central error handler (ZodError/body-parser/Prisma mapping), CSRF (Origin
  allow-list + conditional JSON check), login/logout/me/change-password. 90
  tests. Full detail in `docs/decisions.md` D16–D22.
- **Package 1.3b — fixes before the gate approval** (`2f43bf4`): (1)
  resolved D21 (Next's proxy never forwards the real client IP) by replacing
  the per-IP login limiter with a global flood ceiling (`skipSuccessfulRequests`
  on both remaining limiters, D23); (2) root-caused and fixed the `pnpm dev`
  startup race — not a timing issue with `packages/shared`'s rebuild (though
  that redundant rebuild was real and separately fixed) but `pnpm -r
  --parallel`'s own scheduler breaking `tsx watch`'s child-process startup
  (D24); replaced with `scripts/dev.mjs`. Verified with 5 clean cold-state
  runs, then re-verified again after the review gate (see §15's latest
  entry). 92 tests (2 net new after the rate-limit test rewrite).
- **Package 1.4 — users module, last-Admin rule, audit log** (`7e780de`):
  full user CRUD, the last-Admin rule via a raw `SELECT ... FOR UPDATE`
  (verified with a real concurrency test — two Admins demoted at once,
  exactly one succeeds), deactivate/reset-password deleting the target's
  sessions, one audit row per mutation with before/after metadata and no
  secrets, cross-organisation 404s. 123 tests (124 after the D25 follow-up
  fix below). `docs/decisions.md` D25.
- **Package 1.4 follow-up** (`18510fb`): fixed a real gap flagged on review
  — `user.role_changed`'s audit metadata only carried `oldRole`/`newRole`
  when a `PATCH` changed both `name` and `role` in one request; it now also
  carries `oldName`/`newName`. One new test added (124 tests total). This
  commit also brought this file current through 1.2c–1.4 (it had been
  stale since the 1.1/1.2 session).
- **Package 1.5 — web shell, login, Users page**: Next.js UI for everything
  1.3/1.4 built. `AuthGuard` (client-side nav only, never the security
  control — D26) + role-aware `AppShell` (sidebar, user menu, logout);
  `/login` (React Hook Form + the shared Zod schema, inline errors, generic
  failure message); `/` (Home placeholder); `/users` (server-paginated
  table, search/role/status filters, create/edit/deactivate/reactivate/
  reset-password dialogs, 409 `LAST_ADMIN` and field errors shown inline,
  unexpected errors as a toast with the request id); `/forbidden` (403);
  `not-found.tsx` (404). 10 shadcn components added
  (input/label/form/table/dialog/dropdown-menu/badge/sonner/skeleton/
  select/alert). Verified: `pnpm build` clean, all 5 routes render; full
  login→me→users-list→logout cycle proven with curl through the :3000 proxy
  (no browser in this environment); `docs/MANUAL-TEST-DAY1.md` written for
  the user to run the parts only a browser can show. See `docs/decisions.md`
  D26 for what was non-obvious (the missing `lucide-react` dependency, the
  `Suspense fallback={null}` blank-flash finding, the deliberate absence of
  any `proxy.ts`).
- **Package 1.6 — Grow Spark design system applied to `apps/web`**: tokens
  loaded once (`design-tokens.css`, verbatim from `docs/design-system/`)
  and mapped through Tailwind v4's `@theme inline` to every shadcn semantic
  colour; theming switched to `data-theme` with a Light/Dark/System toggle
  in the (rebuilt) user menu; Inter + JetBrains Mono via `next/font`
  (400/500/600 only); `AppShell` rebuilt as a 240px dark sidebar (Sales
  product chip) + 56px top bar carrying the page title; Button/Field
  (Input/Label)/Badge/Alert/Table restyled and Tabs added, all matching
  their component READMEs; shared INR/date/time formatters
  (`lib/format.ts`) with 12 unit tests (new `vitest` devDependency,
  approved before adding); the one other hard-coded colour found
  (`dialog.tsx`'s `bg-black/50` scrim) fixed to the README's documented
  `bg-ink/40`; duplicate per-page `<h1>`s removed now that the top bar
  carries the title; the pasted hydration-mismatch error fixed with
  `suppressHydrationWarning` on `<html>`. `pnpm typecheck && pnpm lint &&
  pnpm test && pnpm build` all pass (136 tests total: 124 `apps/api` +
  12 new `apps/web`). Console-clean on `/login` and `/` was checked via
  `curl` against the SSR payload (confirms `suppressHydrationWarning`
  reaches `<html>`, no server exception markers) — not a live browser
  console, which this environment cannot run; added as an explicit manual
  check in `docs/MANUAL-TEST-DAY1.md` §15 instead (renumbered from §12
  after package 1.7 inserted its own sections before it — see §13/§14).
  Full detail in `docs/decisions.md` D27.
- **Package 1.7 — search box pattern, session expiry, Cache Components
  validation**: `SearchInput` (magnifier runs the search, clear-`x`
  appears once there's text and resets the filter) replaces the Users
  page's separate input+button, built as a reusable wrapper so Leads/
  Companies/Contacts can reuse it unchanged. A global 401 handler
  (`api-client.ts`'s `onUnauthorized`, registered by the new
  `SessionExpiryHandler`) now clears the TanStack Query cache and redirects
  to `/login?next=<path>` on **any** API call's 401, not just the ones
  TanStack Query itself tracks — guarded against redirect loops and
  against firing on `/login`'s own (expected) failed-login 401.
  `useMe()` now revalidates on window focus; `AuthGuard` revalidates it on
  every route change inside the protected shell too — together these catch
  a deactivated user on their next focus or navigation, not just on a
  manual refresh. Cache Components' dev-only "instant navigation"
  validation notice on protected pages is silenced with one `export const
  instant = false;` on `(protected)/layout.tsx` (confirmed with the user
  what the fix should be — the earlier decision referenced wasn't
  recoverable from this repo's history). `pnpm typecheck && pnpm lint &&
  pnpm test && pnpm build` all pass (140 tests: 124 `apps/api` + 16
  `apps/web`, 4 new this package). Full detail in `docs/decisions.md` D28.

## 8. Database

- **Migrations applied via** `prisma migrate deploy` (root: `pnpm db:migrate`,
  reads `DATABASE_URL`). The one migration so far is
  `20261118202744_init` — note this is **not** what Phase A originally
  generated: an earlier unapplied folder (`20261118201529_init`) was deleted
  and regenerated after schema-approval amendments, so the timestamp in the
  folder name does not reflect package 1.2's actual start time.
- **Table list, columns, indexes, FKs, CHECKs**: see
  `apps/api/prisma/SCHEMA-SUMMARY.md` (479 lines) — don't re-derive this from
  `schema.prisma` by hand, it's already written out per-model.
- **Conventions** (all verified in the actual schema/migration SQL this
  session, not assumed):
  - Every `id` is `uuid`, generated by **Prisma Client** (`uuid(7)`), **not**
    the database — confirmed by the migration SQL having no `DEFAULT` on any
    `id` column. Same for `updated_at` (`@updatedAt`) — also client-supplied,
    no DB trigger or default. Any raw SQL insert/update must supply both
    itself.
  - `organization_id` is a NOT NULL column + FK on every table except
    `organizations` itself. The database does **not** enforce that related
    rows share an organisation (no composite FKs) — that's a service-layer
    responsibility, not yet built (`decisions.md` D13).
  - `onDelete: Restrict` on every foreign key — nothing is ever hard-deleted;
    business records get an `archived_at` instead.
  - 16 CHECK constraints and several partial indexes exist only as
    hand-written SQL inside the migration file (Prisma's schema language
    can't express either) — all documented in the migration file's own header
    comment and in `SCHEMA-SUMMARY.md`.
- **What the seed creates** (`apps/api/prisma/seed.ts` /
  `apps/api/prisma/seed-lib.ts`, idempotent — safe to run any number of
  times, refuses when `NODE_ENV=production`):
  - Organization "Grow Spark Consulting" (Asia/Kolkata, INR) — found-or-
    created by name.
  - Two users: `admin@growspark.test` (Admin) and `staff@growspark.test`
    (Staff) — passwords come **only** from the `SEED_ADMIN_PASSWORD` /
    `SEED_STAFF_PASSWORD` env vars, no default anywhere in code.
  - 7 lead sources, 1 default pipeline ("Sales Pipeline") with 6 stages.
- **Current state of both databases** (checked via `psql` this session):
  both `crm_dev` and `crm_test` have the one migration applied and the full
  seed data present (1 org / 2 users / 7 sources / 1 pipeline / 6 stages; 0
  leads/companies/deals — nothing beyond the seed has ever been created).
  `crm_test` additionally carries whatever the last test run left (the schema
  tests clean up their own rows; the seed data is deliberately left in place
  to prove idempotency).

## 9. Decisions index

`docs/decisions.md` has **its own numbering starting at D1**; the user's
separate planning roadmap (not in this repo) uses different decision IDs —
don't confuse the two when discussing "D-numbers" with the user.
**Note the gaps**: D3 and D5 do not exist in this file — they were never
assigned here (the original brief started numbering at D1, D2, D4, D6,
skipping D3/D5, presumably reserved in the user's own roadmap).

- D1 — pnpm monorepo layout (apps/web, apps/api, packages/shared)
- D2 — Auth deferred to a later package; nothing built for it yet
- D4 — Single currency: INR
- D6 — Organisation timezone: Asia/Kolkata
- D7 — TypeScript pinned to 6.0.3, not npm "latest" (7.0.2)
- D8 — ESLint 10 flat config; `next lint` doesn't exist in Next 16
- D9 — `packages/shared` ships compiled output, not raw TS source (amended by D12)
- D10 — pnpm 11 `allowBuilds` (replaces `onlyBuiltDependencies`); what got approved and why
- D11 — `cn`/`radix-ui` dependency verification (shadcn CLI really does generate these)
- D12 — Hardened `packages/shared`'s build against a stale-cache failure mode
- D13 — Same-organisation integrity is service-level, not a composite FK
- D14 — Schema-approval amendments (indexes/uniques/CHECKs) applied before Phase B
- D15 — Package 1.2 policy summary: lead CHECK, loss reasons, snake_case, enum policy, normalised columns, UUID choice, seed rules, Prisma error codes (P2039/P2002/P2003), why `migrate reset` stays manual
- D16 — Package 1.3 dependencies: `cookie@2.0.2` (renamed exports, v2), `express-rate-limit@8.7.5`
- D17 — `@node-rs/argon2` library defaults (Argon2id, v0x13, m=19456, t=2, p=1); the login timing-defence dummy hash
- D18 — body-parser error shapes for malformed/oversized bodies (`status`+`type`, both mapped to code `BAD_REQUEST`)
- D19 — Express 5's internal route-tree shape (`app.router.stack`, `rawPath`); `req.query` has no setter
- D20 — CSRF Content-Type check only applies when a request actually carries a body (bodyless writes like logout have none)
- D21 — Next's `rewrites()` proxy forwards neither `X-Forwarded-For` nor `X-Forwarded-Proto` — addressed by D23
- D22 — `NODE_ENV=test` during `pnpm test` (vitest sets it; `process.loadEnvFile` never overrides an already-set var) — logger goes silent in tests
- D23 — Package 1.3b: replaced the per-IP login limiter with a global flood ceiling (`createGlobalLoginFloodLimiter`, default 50/15min); both limiters now use `skipSuccessfulRequests`; real per-IP limiting deferred to a deployment decision
- D24 — Package 1.3b: root cause and fix for the `pnpm dev` startup race — `pnpm -r --parallel`'s own scheduler breaks `tsx watch`; replaced with `scripts/dev.mjs` (independent `pnpm --filter` children, no new dependency)
- D25 — Package 1.4: last-Admin `SELECT ... FOR UPDATE` locking pattern; the `isActive` boolean query-param gotcha (`z.coerce.boolean()` is wrong — `Boolean("false")` is `true`); the `sort=<field>:asc|desc` convention; one audit row per `PATCH`, with before/after for every changed field (fixed after review to include `oldName`/`newName`, not just the role pair)
- D26 — Package 1.5: no `proxy.ts` (Next 16 renamed `middleware`, recommends against relying on it for security either way); `lucide-react` missing from the shadcn CLI's own output; `next-themes` is Sonner's dependency, not a separate choice; a `Suspense fallback={null}` is a real blank flash under Cache Components, not a no-op; the error-display split (422 inline on the field, 409/401/403 as a dialog banner, 500/network as a toast with the request id)
- D27 — Package 1.6: design system tokens mapped through Tailwind v4's `@theme inline`; theming switched to `attribute="data-theme"` with the toggle in the user menu; shadcn's structural `accent` repointed to `surface-hover`/`ink` so GS's brand clay accent (its own `--color-brand-accent*` names) stays rare, not merged into generic hover states; `@custom-variant dark` now targets `[data-theme="dark"]`, not `.dark`, so shadcn's baked-in `dark:*` utilities follow the app's own toggle instead of the OS media query; Button/Badge/Alert variants remapped (not renamed) onto the component READMEs, including fixing `destructive`'s old literal `text-white`; the dialog scrim fixed to the README's documented `bg-ink/40`; `vitest@5.1.1` added to `apps/web` (approved first) for `lib/format.ts`'s unit tests; INR/date/time formatting choices (`Intl.NumberFormat("en-IN")` for grouping, not `style: "currency"`; L/Cr thresholds at exactly 1 lakh/1 crore; `en-US` for reliably upper-cased AM/PM)
- D28 — Package 1.7: `SearchInput` reusable component (magnifier + clear-x, wraps the existing `Input`); global 401 handling lives in `api-client.ts`'s `apiFetch` itself (`onUnauthorized`), not TanStack Query's `QueryCache`/`MutationCache`, because several mutations are plain awaited calls those hooks never see; `SessionExpiryHandler` clears the cache and redirects once, guarded against both a parallel-request burst and `/login`'s own expected 401 on a wrong password; `useMe()` gets `refetchOnWindowFocus: true` as a deliberate one-query exception to the `QueryClient`'s app-wide `false`; `AuthGuard` revalidates `/auth/me` on every route change after first mount; Cache Components' "instant navigation" dev notice fixed with `export const instant = false` on `(protected)/layout.tsx` only (can't be set on `users/page.tsx`, a Client Component — throws if you try)

## 10. Gotchas and lessons learned

- **pnpm 11's `allowBuilds`** replaced `onlyBuiltDependencies` entirely — a
  bare `onlyBuiltDependencies: []` does nothing in pnpm 11. Approve one
  package at a time with a reason (`esbuild`, `prisma`, `@prisma/engines` so
  far) — never a blanket allow-all.
- **Stale `.tsbuildinfo` can make a build silently no-op.** `composite: true`
  implies an incremental cache; if `dist` is deleted but the cache survives,
  `tsc` believes `dist` is current and emits nothing. Fixed by setting
  `incremental: false` on `packages/shared`'s build.
- **`packages/shared` must be built before every** `typecheck`/`lint`/
  `test`/`build`/`dev` run, not just once — pnpm's script-name topological
  ordering doesn't help scripts that don't build shared themselves. Root
  scripts now do this unconditionally, plus a `prepare` hook as backup.
- **Leftover dev processes are easy to create, hard to kill correctly.**
  `pkill -f` pattern matching has failed silently. `taskkill /PID <pid> /T
  /F` by exact, verified PID is reliable on Windows. A tool's own "stopped"
  message isn't proof the OS process died — verify with `tasklist`/`netstat`.
- **Next.js 16 removed `next lint`** (call `eslint .` directly); **Prisma 7
  removed auto-seeding** on `migrate dev`/`reset` (seeding is explicit-only).
- **shadcn's CLI changed significantly** — `shadcn init` now wants an
  interactive prompt or a web-UI preset code; `lib/utils.ts` + `clsx` +
  `tailwind-merge` is legacy. Verify what the *installed* version actually
  generates (`shadcn add <x> --view` is a safe dry-run) rather than trusting
  memory.
- **The `cn` npm package has a strange history** (abandoned 2013 joke
  package, taken over by shadcn-ui in 2026) — looks suspicious, is
  legitimate; verified via downloads/publish history/CLI behaviour first.
- **Prisma 7 + driver adapters uses different error codes than classic
  Prisma docs**: CHECK violations are `P2039`, not `P2004`. Unique (`P2002`)
  and FK/Restrict (`P2003`) are unchanged. Verified empirically — D15.
- **`process.loadEnvFile` does not override an already-set env var** —
  confirmed empirically; this is how migrations get applied to `crm_test`
  instead of `crm_dev` despite `.env` defaulting to `crm_dev`.
- **Files outside `tsconfig.json`'s `include: ["src"]` aren't type-checked**
  by `tsc --noEmit`, though they run fine via `tsx`/`vitest`: affects
  `apps/api/scripts/*.ts`, `prisma/seed*.ts`, everything under `tests/`.
  ESLint still covers them. Known, not fixed.
- **Prisma 7's CLI refuses certain commands when it detects an AI agent**
  invoking it, demanding fresh human consent every time — §3, D15.
- **`pnpm -r --parallel` can break `tsx watch` on this machine** — reproduced
  with zero output, zero errors, even with a single package in scope. Fixed
  by not using it (`scripts/dev.mjs`, D24). If `pnpm dev` ever seems to hang
  again with apps/api never logging "api listening", check that this script
  is still what's being invoked, not a reverted `pnpm -r --parallel dev`.
- **`z.coerce.boolean()` is wrong for a query-string boolean** —
  `Boolean("false")` is `true` in JS. Use an explicit `z.enum(['true',
  'false']).transform(...)` instead (`booleanQueryParam`, D25).
- **Express 5's `req.query` has no setter** (`defineGetter` only, verified in
  `express/lib/request.js`) — a validated query goes on `req.validatedQuery`
  instead (D19). `req.body`/`req.params` are plain properties and can be
  overwritten normally.
- **`cookie@2.x` renamed its exports** — no `serialize`/`parse`; use
  `stringifySetCookie`/`parseCookie` (D16).
- **Prisma's query builder has no row-locking API** — the last-Admin rule
  uses a raw `tx.$queryRaw` with `SELECT ... FOR UPDATE`, casting to the
  Postgres enum by its mapped name (`'ADMIN'::role`, not `'ADMIN'::"Role"`) — D25.
- **The shadcn CLI can write a component's imports without actually
  installing the import's package.** `dialog`/`dropdown-menu`/`select`/
  `sonner` all import from `lucide-react`; the CLI never added it as a
  dependency. Surfaced immediately by `tsc`, not silently — but check
  `node_modules/<pkg>` exists after any future `shadcn add`, don't assume
  the CLI's dependency step actually ran for everything it should have.
- **A `<Suspense fallback={null}>` is not equivalent to "nothing changes
  while loading"** — with `cacheComponents: true`, the fallback genuinely
  replaces that subtree in the *prerendered* HTML. `null` means the real
  content (here, the entire login form) is simply absent from the page
  until client-side hydration completes, which a `curl` of the page makes
  obvious immediately (no form markup at all) but a fast browser might hide
  well enough to go unnoticed. Give it a real fallback shaped like the
  content (D26).
- **Next.js route groups `(name)` share a URL with whatever's outside
  them** — `app/(protected)/page.tsx` and a pre-existing `app/page.tsx`
  both resolve to `/`; the old one has to be deleted, not just left
  alongside, or the build fails on a route conflict.
- **This repo's own command examples use Windows `cmd.exe` syntax, not
  PowerShell** — `netstat -ano | findstr :3000`, `taskkill /PID <pid> /T
  /F`, `copy apps\api\.env.example apps\api\.env` (see §4's "Starting
  everything from scratch"). Keep new examples in that same style (e.g.
  `findstr`, not `Select-String`; `copy`, not `Copy-Item`) unless the user
  specifically asks for PowerShell.
- **Two browser windows split-screened side by side (tiled on the same
  desktop) still share one cookie store if they're the same browser
  profile** — only one authenticated session can exist across them at a
  time. Testing two different users signed in simultaneously (e.g. the
  session-expiry-while-open scenario in `MANUAL-TEST-DAY1.md` §14, or the
  deactivate-while-signed-in scenario in §10) needs a normal window *plus*
  an incognito/private window — two genuinely separate cookie stores — not
  two tiled views of the same window.

## 11. Testing

- `pnpm test` (root) runs `packages/shared` (no tests yet — its schemas are
  exercised via `apps/api/tests/shared/`), `apps/web` (`vitest run` — 2
  files: `tests/lib/format.test.ts` (12 tests, package 1.6),
  `tests/lib/api-client.test.ts` (4 tests, package 1.7)), and `apps/api`
  (`vitest run`) — 124 `apps/api` tests + 16 `apps/web` tests, 140 total,
  all passing as of the last run this session.
- `apps/web/vitest.config.mts` only sets a resolve alias (`@` -> the package
  root, mirroring `tsconfig.json`) — no database, no global setup, unlike
  `apps/api`'s config; nothing in `apps/web` touches the database.
- `apps/api/tests/schema/helpers.ts` provides `createTestOrganization`,
  `createTestUser`/`LeadSource`/`Company`/`Contact`/`Pipeline`/`Deal`,
  `cleanupOrganization` (deletes a test org's rows in FK-safe,
  children-first order, since everything is `onDelete: Restrict`), and
  `expectRejection(promise, code, constraintNameFragment)` for asserting a
  specific Prisma error code *and* that the right constraint fired.
  `PG_ERROR`/`isKnownRequestError` are now re-exported from
  `src/lib/prisma-errors.ts` (single source, since the app's own error
  handler needs the same codes — package 1.3).
- **Global test isolation (package 1.2c/1.3b)**: `tests/setup.ts` registers
  a global `beforeEach` that calls `resetDatabase()` (TRUNCATEs every
  application table; refuses unless the connected database name ends
  `_test`) and `resetLoginRateLimiters()` (clears the in-memory rate-limit
  stores) before *every* test in *every* file — not just the schema tests.
  Existing per-test `cleanupOrganization()` calls stay in place and are
  harmless (redundant, not conflicting).
- `createTestTenant()`/`createTwoTestTenants()` (`tests/helpers/tenant.ts`)
  build a full organisation with real argon2id-hashed Admin/Staff users
  (known passwords) and a lead source — used throughout the auth/users/audit
  tests, not just where they were first built.
- `apps/api/vitest.config.ts` sets `fileParallelism: false` — all tests share
  one database (`crm_test`, via `TEST_DATABASE_URL`) and must not run
  concurrently. Vitest still spawns one worker process per test *file*
  (`isolate: true`, the default) — module-level state (e.g. the rate-limit
  stores) is shared across `it()` blocks *within* one file but fresh per
  file; the global `beforeEach` above exists because of this.
- **`db:verify-fresh` is manual and intentionally never part of `pnpm test`**
  — it drops and recreates `crm_test` from zero, and Prisma's own CLI refuses
  to run that without fresh human consent each time anyway. Run it yourself
  before a release: `pnpm db:verify-fresh`.
- **Known gaps**: `apps/web`'s test coverage is still only pure-logic
  (`lib/format.ts`, `lib/api-client.ts`'s `onUnauthorized`) — no component/
  integration tests for `SearchInput`, `SessionExpiryHandler`, `AuthGuard`,
  or anything else that needs a DOM. That needs `jsdom` +
  `@testing-library/react`, neither installed; not added in package 1.7
  since it wasn't the dependency actually asked for that package (unlike
  `vitest` itself in 1.6, which was asked and approved) — raise it
  explicitly if/when component tests are wanted. Test files aren't
  type-checked by plain `tsc -p tsconfig.json` but now are by the wider
  `tsconfig.check.json` (package 1.2c) wired into `pnpm typecheck`.

## 12. Conventions every future module must follow

- Service functions take a context `{ userId, orgId, role }` — never read
  these off a raw request object inside a service.
- Every database query is scoped by `organizationId` taken from that context
  via the `scoped(ctx)` helper (`apps/api/src/lib/scoped.ts` — returns
  `{ organizationId: ctx.orgId }`), not a hand-written filter re-spelled per
  module; a record belonging to a different organisation must look like a
  404, not a 403 (don't leak existence).
- Every route declares a required permission explicitly.
- Request bodies/params/query are validated via `validateRequest`
  (`apps/api/src/middleware/validate.ts`) using a `packages/shared` Zod
  schema — body/params overwrite `req.body`/`req.params`; a validated query
  goes on `req.validatedQuery` instead, since Express 5's `req.query` has
  no setter (D19). Never validate ad hoc inside a route handler.
- Multi-table writes happen inside one transaction, with the audit row
  written inside that same transaction (not after, not best-effort).
- `packages/shared`'s Zod schemas are the single source of validation — don't
  re-declare the same shape in `apps/api` or `apps/web`.
- Error responses follow the shape already established in
  `apps/api/src/middleware/error-handler.ts`:
  `{ error: { code, message, details?, requestId } }`.
- API routes live under `/api/v1/*` (already true for `/health`; follow the
  same prefix for every real endpoint).
- **Every route is declared via `defineRoute()`**
  (`apps/api/src/lib/route-registry.ts`), never `app.get()`/`router.post()`
  etc. directly — `defineRoute` wires the session and permission middleware
  consistently and records the route so a test can audit the live Express
  app's route tree against it. `tests/lib/route-registry.test.ts` includes
  a deliberate proof that this check can actually fail (adds a route
  bypassing `defineRoute`, asserts it's caught, then asserts a clean app
  passes again) — a future module can copy that proof pattern instead of
  re-inventing it.
- An exclusivity/cardinality invariant that must survive concurrent
  requests (so far: "at least one active Admin") is enforced with a raw
  `SELECT ... FOR UPDATE` inside the transaction, not an application-level
  check-then-write — see `assertNotLastActiveAdmin` in
  `users.service.ts` for the pattern, and its concurrency test for how to
  prove it.
- **Frontend (package 1.5 conventions):** every authenticated page goes
  inside the `app/(protected)/` route group, behind its one `AuthGuard` +
  `AppShell` layout — never a standalone auth check re-implemented per
  page. A mutation's error handling always goes through
  `handleApiFormError` (`apps/web/lib/handle-form-error.ts`), not a
  bespoke try/catch per dialog, so the 422-inline / 409-banner /
  500-toast-with-request-id split stays consistent everywhere. Client
  components that read `useSearchParams()` need a real `<Suspense>`
  fallback (not `null`) — see the gotcha above.
- **Every colour, radius, shadow, size and font comes from a Grow Spark
  design-system token** (`apps/web/app/design-tokens.css`, mapped through
  Tailwind v4's `@theme inline` in `globals.css`) — never a hex literal or
  a bare Tailwind palette class (`bg-slate-500`, `text-red-600`, etc.) and
  never `white`/`black` directly. Use the generated utility (`bg-surface`,
  `text-ink-muted`, `border-danger`, …) or an explicit token reference
  (`h-(--control-md)`) for a size that has no Tailwind equivalent. See
  `docs/decisions.md` D27.
- **A page needing its own route-segment config (`export const dynamic`,
  `instant`, etc.) must be a Server Component** — Next.js throws if
  `instant` (or most other segment config) is exported from a file with
  `"use client"` at the top. `(protected)/layout.tsx` is one today
  (`instant = false`, D28). **Not yet applied, but the intended pattern
  going into Day 2**: keep `page.tsx` itself a thin Server Component
  (default export, no `"use client"`) that just renders a separate client
  component holding the actual interactive logic (`"use client"` on that
  inner component instead) — so `page.tsx` stays free to carry its own
  `instant`/other segment config. `apps/web/app/(protected)/users/page.tsx`
  is currently `"use client"` directly and does **not** follow this
  pattern yet — see `docs/NEXT-SESSION-START.md`'s open items.
- **Search inputs reuse `SearchInput`**
  (`apps/web/components/ui/search-input.tsx`) — a magnifier icon runs the
  search (same as Enter), a clear `x` appears once there's text and
  re-runs the search empty. Don't rebuild a separate input+button pattern
  for Leads/Companies/Contacts' search boxes.
- **Any new `apiGet`/`apiPost`/`apiPatch` call automatically participates
  in session-expiry handling** — `apps/web/lib/api-client.ts`'s `apiFetch`
  notifies a registered `onUnauthorized` listener on every 401, regardless
  of how the call was made (a direct `await`, not just a `useMutation`).
  Nothing extra is needed per call site for this to work; don't add a
  bespoke 401 check in a new dialog/page.

## 13. What's next

- **Day 1 (packages 1.1–1.7) is done** (see §7). Every explicit approval
  gate (1.3's permission map, D20/D21→D23) was approved; D25's
  audit-metadata gap was fixed on review before 1.5 started; adding
  `vitest` to `apps/web` in 1.6 was confirmed with the user before doing it;
  1.7's Cache Components fix was confirmed with the user (the earlier
  decision it referenced wasn't recoverable from this repo's history, so
  it was asked again rather than guessed).
- **Not yet done, and not part of Day 1's scope**: the actual browser
  click-through in `docs/MANUAL-TEST-DAY1.md` (now including the package
  1.6 design-system section §12/§15 and the 1.7 search/session-expiry
  sections §13/§14) — this environment has no browser, so that still needs
  the user to run it before Day 1 is truly *verified*, not just built and
  automatically tested.
- Beyond Day 1: the user's planning roadmap continues into Day 2 (companies,
  contacts, leads). **A fresh session should start from
  `docs/NEXT-SESSION-START.md`**, not this section — it has the actual Day 2
  package order (2.0 leftovers, then 2.1–2.3 backend, then 2.4–2.6 UI) and
  the open items. Four Day 2 rules were approved on 2026-11-19 (end of this
  Day 1 handover session) but **nothing against them is built yet**: lead
  status transitions (any open status to any other; `CONVERTED` only via
  the Day 3 convert action; every change writes `LeadStatusHistory`), lead
  creation requires a name plus an email or a phone, duplicate detection
  (exact normalised email/phone/company name) warns only and still saves,
  and Staff may create/edit/archive companies/contacts/leads — see
  `docs/decisions.md` D29. Day 6/7 (testing, stabilisation, demo) are
  explicitly out of scope until the build days are done.

## 14. Open questions and unverified items

- **Resolved**: the `origin/main` tracking mystery (local now matches
  exactly — still unverified *who* pushed, but no longer blocking); the
  website-repo rule is now in `CLAUDE.md` (1.2c); `README.md`'s stale
  "package 1.1 only" wording is fixed (1.2c).
- **D21/D23 — real per-IP login limiting is deferred, not solved.** It needs
  the true client IP to reach this API, which it currently does not when
  traffic comes through the Next.js web app's proxy. This is a deployment-
  architecture decision (how/whether a reverse proxy in front of both apps
  sets and forwards `X-Forwarded-For`), not something to engineer around in
  application code. Revisit before relying on it as a real control.
- The exact plan for Days 2–5 beyond what's already built — the user told me
  the 7-day shape (build/test/stabilise) but not full detail for every
  package; don't invent content for them.
- **`docs/MANUAL-TEST-DAY1.md` has not actually been run by anyone yet** —
  written this session, but this environment has no browser to execute it
  against. Everything in it is believed correct from the curl-based
  verification and the automated test suite, but a real click-through may
  still surface something (e.g. a layout issue, a focus/accessibility
  detail) that neither of those would catch.
- **Package 1.6's console-clean check is unverified in a real browser** —
  same root cause as above (no browser-automation tool in this
  environment). The `suppressHydrationWarning` fix is the standard,
  documented fix for the exact pasted error (next-themes writing
  `class`/`style`/`data-theme` onto `<html>` after mount) and the SSR
  payload confirms the prop is reaching `<html>`, but neither proves the
  browser console is actually silent — that's §15 of
  `docs/MANUAL-TEST-DAY1.md`, still outstanding.
- **A full list of open items from package 1.7 and this handover session
  lives in `docs/NEXT-SESSION-START.md` ("Open items")** — not duplicated
  here to avoid the two files drifting apart. In short: the Cache
  Components notice still appears on `/users` (the `(protected)/layout.tsx`
  fix wasn't enough on its own); no password-visibility toggle anywhere;
  the Users search value isn't in the URL; `SearchInput`/
  `SessionExpiryHandler` have no component tests; and whether route-change
  revalidation actually produces a fast redirect in a real browser (versus
  needing a refresh) was reasoned through from the code but not watched
  happen — see that file for the full, individually-verified list.

## 15. Session log

**Append-only.** At the end of every session, add a new dated entry below —
do not edit or delete earlier entries. If reality changed (new packages
built, decisions revised, gotchas found), update the sections above too; this
log just records that a session happened and what it covered.

- **2026-11-19** — Packages 1.1, 1.1b, and 1.2 (Phases A & B) completed and
  committed locally (17 commits total, none pushed). Final test count: 20
  tests passing in `apps/api` (12 files). Nothing left uncommitted — working
  tree was clean before this handover file was written. Created this file and
  added start/end-of-session rules to `CLAUDE.md`.
- **2026-11-19 (continued, same day)** — Packages 1.2c, 1.3, 1.3b, and 1.4
  completed and committed locally (4 more commits: `307e373`, `c095a9c`,
  `2f43bf4`, `7e780de`; still nothing pushed). 1.3's permission map and D20
  were an explicit approval gate (approved); D21 (per-IP limiter weakness)
  and the `pnpm dev` race were fixed in 1.3b before that approval; D25's
  audit-metadata gap (role_changed missing name before/after when both
  changed in one PATCH) was fixed on review, before starting 1.5 — one new
  test added, not yet in its own commit at the time this entry was written
  (will land with or just before 1.5's commit). Test count: 124 passing in
  `apps/api`. Re-verified on request, after the review gate: the 5
  rate-limit tests (`tests/auth/rate-limit.test.ts`) all pass, proving D21's
  fix; `pnpm dev` ran cleanly 5 more times in a row from a cold state (ports
  checked free before each, both services answering within 10–32s each
  time, ports confirmed free after each `taskkill .../T /F`). Working tree
  clean after each commit.
- **2026-11-19 (continued, same day) — package 1.5, Day 1 complete.** Web
  shell, login page, role-aware navigation, 403/404 pages, and a full Users
  page (create/edit/deactivate/reactivate/reset-password, server-side
  pagination/search/filters) built on top of 1.3/1.4's API. 10 shadcn
  components added; `lucide-react` had to be added separately (the CLI
  referenced it without installing it); `next-themes`/`react-hook-form`/
  `@hookform/resolvers`/`sonner` re-pinned to exact versions after the CLI
  added them with `^` ranges. Found and fixed one real bug via this
  session's own curl verification (not assumed): `/login`'s `Suspense`
  fallback was `null`, so the entire form was missing from the prerendered
  HTML until hydration — replaced with a skeleton matching the form's
  shape. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass
  from a clean state (124 tests, unchanged from 1.4 — this package added no
  new `apps/api` code). Verified end-to-end through the real :3000 proxy
  with curl: login → me → users list → logout, each returning exactly what
  it should. Wrote `docs/MANUAL-TEST-DAY1.md` for the user to run in an
  actual browser, which this session could not do itself — that run is
  still outstanding (see §14). This file (`PROJECT-STATE.md`) was updated
  fully for status/repository-map/stack/decisions-index/gotchas/what's-next
  per the explicit "end of Day 1" instruction, not just appended to.
  Day 1 (packages 1.1 through 1.5) is now complete and committed locally;
  nothing has been pushed. Next: Day 2 (companies, contacts, leads) —
  not yet detailed in this repo.
- **2026-11-19 (continued, same day) — package 1.6, design system applied.**
  Loaded `docs/design-system/` (README, tokens.css, component READMEs,
  bundle.css — all present) and applied it to `apps/web`: tokens wired
  through Tailwind v4's `@theme inline`; theming switched from the 1.5
  `forcedTheme="light"` placeholder to `data-theme` with a real
  Light/Dark/System toggle in a rebuilt user menu; Inter + JetBrains Mono
  via `next/font`; `AppShell` rebuilt (240px dark sidebar with the Sales
  product chip, 56px top bar carrying the page title); Button, Field
  (Input/Label), Badge, Alert, Table restyled and Tabs added, each matching
  its component README; shared `formatINR`/`formatINRCompact`/`formatDate`/
  `formatTime` helpers added with 12 unit tests, which needed `vitest`
  adding to `apps/web` as a devDependency — asked the user first per
  `CLAUDE.md`, approved, pinned to the same `5.1.1` already in `apps/api`.
  Fixed the hydration-mismatch error pasted at the start of this package
  (`suppressHydrationWarning` on `<html>` in `layout.tsx`) and the one other
  hard-coded colour found outside the token file (`dialog.tsx`'s
  `bg-black/50` scrim, now `bg-ink/40` per the README's own spec). Removed
  the duplicate per-page `<h1>`s now that the top bar owns the title.
  `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
  (136 tests: 124 `apps/api` + 12 new `apps/web`). Verified via `curl`
  against the already-running dev server that `/login` and `/` still
  return 200 and that `suppressHydrationWarning: true` actually reaches
  `<html>` in the SSR payload; a live browser console check was not
  possible in this environment (no browser-automation tool available) and
  is now an explicit manual item in `docs/MANUAL-TEST-DAY1.md` §15
  (renumbered from §12 in package 1.7), which also gained checks for theme
  switching, no-pure-white/black, fonts, visible focus rings, and the badge
  dot-plus-word rule. Two ports (3000, 4000) were already occupied at
  session start by node processes that predate this session (the user's
  own long-running `pnpm dev`, consistent with the pasted error having
  come from a live dev session) — left running rather than killed, since
  this session did not start them.
- **2026-11-19 (continued, same day) — package 1.7, three small fixes.**
  (1) Replaced the Users page's separate search `Input` + "Search"
  `Button` with a new reusable `SearchInput` (magnifier runs the search,
  clear-`x` resets it) meant for Leads/Companies/Contacts to reuse later;
  confirmed the search value was never actually in the URL before this
  package, so nothing needed preserving there beyond not regressing it.
  (2) Added real session-expiry-while-open handling: a module-level
  `onUnauthorized` listener in `api-client.ts` fires on any 401 from any
  `apiGet`/`apiPost`/`apiPatch` call (covering direct mutation calls, not
  just ones wrapped in TanStack Query), and the new `SessionExpiryHandler`
  (mounted once in `providers.tsx`) clears the query cache and redirects
  to `/login?next=<path>` exactly once — guarded against both a parallel-
  request burst and `/login`'s own expected 401 on a wrong password.
  `useMe()` now revalidates on window focus; `AuthGuard` revalidates it on
  every route change inside the protected shell. Added 4 unit tests for
  `onUnauthorized` (mocked `fetch`, no DOM needed); `SearchInput` and
  `SessionExpiryHandler` themselves are not unit tested — that needs
  `jsdom`/`@testing-library/react`, not installed and not what was asked
  for in this package, flagged as a gap rather than added silently.
  (3) For the Cache Components "instant navigation" dev notice: the
  earlier decision this package's brief referred to wasn't recoverable
  from `decisions.md`, `PROJECT-STATE.md`, or any stored session
  transcript, so it was asked again rather than guessed — confirmed as
  `export const instant = false` on the affected routes, applied as one
  export on `(protected)/layout.tsx` (the only Server Component ancestor
  shared by every protected route; can't be set on `users/page.tsx`
  itself, a Client Component — throws if you try). `pnpm typecheck && pnpm
  lint && pnpm test && pnpm build` all pass clean (140 tests: 124
  `apps/api` + 16 `apps/web`, 4 new). Verified via `curl` that `/`,
  `/users`, `/login` still return 200 on the already-running dev server
  after all three changes; a live browser/DevTools check (the search box's
  keyboard/screen-reader behaviour, the two-cookie-store session-expiry
  scenario, the Cache Components dev notice itself) was not possible in
  this environment and is now `docs/MANUAL-TEST-DAY1.md` §13/§14, plus one
  added check in the renumbered §15. `docs/decisions.md` D28. Day 1
  (packages 1.1 through 1.7) remains complete and committed locally;
  nothing has been pushed. The two pre-existing node processes on ports
  3000/4000 were left untouched again, for the same reason as last time.
- **2026-11-19 (continued, same day) — end-of-Day-1 docs handover, no code
  changes.** Full pass over the documentation per the user's explicit
  request, so a brand-new session can continue Day 2 from the repo alone:
  rewrote this file's stale "mystery resolved itself" framing (`git
  status` showed `main` already matching `origin/main` again at the start
  of this session, for the 1.6/1.7 commits — the second time this has
  happened, not a one-off); added an explicit environment-variable-names
  subsection to §4; added two gotchas that existed in practice but weren't
  written down (`cmd.exe`-style command examples, split-screen windows
  sharing one cookie store); added conventions for the design tokens, the
  `SearchInput` pattern, the global 401 handler, and the planned "thin
  Server Component page wrapper" pattern for `instant`; added `docs/
  design-system/`, `DAY-1-SUMMARY.md`, `MANUAL-TEST-DAY1.md`, and
  `NEXT-SESSION-START.md` to the repo map. `docs/decisions.md` got a
  numbering/dating note at the top (every entry D1–D29 happened on
  2026-11-19) and a new **D29** for four Day 2 rules the user approved at
  the end of this session (lead status transitions, lead-creation
  requirements, duplicate-detection-warns-only, Staff permissions on
  companies/contacts/leads) — none of them built yet. Wrote two new files:
  `docs/DAY-1-SUMMARY.md` (plain-language what-was-built/verified/fixed,
  and a how-to-run-and-log-in section) and `docs/NEXT-SESSION-START.md`
  (the actual first-file-to-read: brief, hard rules, reading order, the
  known shape of the Day 2 plan, the Day 4 staging plan, and every open
  item re-verified against the current code before being written down).
  `CLAUDE.md` got one small edit — its "start of session" line now points
  to `NEXT-SESSION-START.md` first.

  Each open item carried into `NEXT-SESSION-START.md` was individually
  checked against the actual code in this session, not carried over on
  assumption: (a) the Cache Components notice on `/users` is confirmed
  still open — `(protected)/layout.tsx` has `instant = false`, but
  `users/page.tsx` is a Client Component and can't carry its own
  exemption, and per the user's own browser testing the layout-level
  setting alone isn't enough; the fix (a thin Server Component wrapper) is
  real but not yet implemented. (b) no password-visibility toggle exists
  anywhere — confirmed by grep, still open. (c) the Users search value is
  still plain `useState`, not in the URL — confirmed by grep, still open.
  (d) no `jsdom`/`@testing-library/react` in `apps/web/package.json` —
  confirmed, no component tests exist for `SearchInput` or
  `SessionExpiryHandler`, still open. (e) **not resolved either way**:
  traced the actual `@tanstack/query-core` reducer source to confirm a
  failed background refetch does set `status: "error"` (so `AuthGuard`'s
  redirect condition should fire), and the global 401 handler is wired
  independently of `AuthGuard` too — on paper this should already work
  promptly, but that's a code reading, not a watched browser test (no
  browser-automation tool in this environment), and it contradicts the
  user's own report of it only working after a refresh. Written up as an
  open, unreconciled discrepancy rather than claimed as fixed. (g) the
  design-system `.zip` is still untracked, confirmed via `git status` —
  intentional, unchanged.

  Verification: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
  all pass, test counts unchanged from package 1.7 as expected for a
  docs-only change (140: 124 `apps/api` + 16 `apps/web`). Process hygiene:
  no process was started this session; ports 3000 and 4000 were both
  already free at session start and remained so throughout — nothing to
  stop. Committed as one docs-only commit; nothing pushed.
