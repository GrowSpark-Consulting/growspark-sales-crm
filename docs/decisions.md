# Decisions

Record of approved architectural decisions for the Sales & CRM project. Each entry
is a decision made once and not re-litigated without a new entry.

- **D1** — pnpm monorepo: `apps/web` (Next.js), `apps/api` (Express), `packages/shared`.
- **D2** — Auth will be our own server-side sessions, built in a later package. Nothing
  implemented for it in package 1.1.
- **D4** — Single currency: INR.
- **D6** — Organisation timezone: Asia/Kolkata.
- **D7** — TypeScript is pinned to **6.0.3**, not the npm "latest" (7.0.2). TypeScript 7
  is the new Go-native compiler rewrite; `typescript-eslint@8.73.0`'s peer dependency
  caps support at `typescript: ">=4.8.4 <6.1.0"` (verified via `npm view typescript-eslint
  peerDependencies` on 2026-11-19). 6.0.3 is the newest version satisfying that range.
  Revisit once typescript-eslint supports TS 7.
- **D8** — ESLint: `next lint` was removed in Next.js 16.0.0 (confirmed on the official
  docs, https://nextjs.org/docs/app/api-reference/config/eslint, 2026-11-19).
  `eslint-config-next@16.4.6` officially supports ESLint 10 via flat config
  (`eslint.config.mjs`). All lint scripts call the ESLint CLI directly
  (`eslint .`), never `next lint`.
- **D9** — `packages/shared` is authored as TypeScript source (Zod schemas, enums) but
  ships a compiled build (`tsc` → `dist/*.js` + `.d.ts`). Both `apps/web` and
  `apps/api` consume the compiled output as a normal workspace dependency, rather than
  importing raw `.ts` source directly. This avoids needing a bundler to make
  `apps/api`'s production build (`tsc` + plain `node dist/index.js`, no runtime
  transformer) resolve a TypeScript-source workspace package — without adding any new
  dependency. Trade-off: editing `packages/shared/src` requires re-running
  `pnpm --filter @growspark/shared build` (or the root `pnpm build`, which runs in
  dependency-topological order) before the change is visible to either app in dev.
  `apps/web` additionally lists `@growspark/shared` in `next.config.ts`'s
  `transpilePackages` for robustness, though Next 16's own docs state Turbopack and
  webpack already auto-transpile workspace packages.
  *Amended by D12 (2026-11-19): the "manual rebuild" trade-off no longer applies
  under `pnpm dev`, which now watch-builds `packages/shared` automatically.*
- **D10** — pnpm 11 removed `onlyBuiltDependencies` in favor of `allowBuilds` (a map of
  `package: true|false`); unlisted packages' install/postinstall scripts are blocked
  by default (confirmed via the pnpm 11 docs, https://pnpm.io/settings/build#allowbuilds,
  2026-11-19). After a clean `pnpm install`, the only package pnpm actually blocked was
  **`esbuild`** (needed at runtime by `tsx` and `vitest`, both already in the approved
  plan) — allow-listed as `esbuild: true`. `@tailwindcss/oxide` (Tailwind v4's native
  engine), `sharp` (a transitive Next.js dependency, unused directly), and
  `unrs-resolver` are all present in `node_modules` but ship prebuilt platform binaries
  with no install script requiring approval, so none were added to `allowBuilds`. No
  blanket allow-all was used.
  pnpm also auto-added a `minimumReleaseAgeExclude` entry for `vitest@5.1.1` and its
  two companions (`@vitest/mocker`, `@vitest/spy`) — this is pnpm's supply-chain guard
  (`minimumReleaseAge`, default ~1 day) stepping aside for versions we pinned exactly
  on purpose, not something we configured by hand.
- **D11** — The `cn`, `radix-ui`, and `class-variance-authority` packages used by
  shadcn's generated `Button` are genuinely what the installed `shadcn@4.23.0` CLI
  requires, not a speculative addition. Verified 2026-11-19 by re-running
  `shadcn add button --view` (a dry run against our real `components.json`) and
  confirming it independently re-resolves to the same `import { cn } from "cn"` /
  `import { Slot } from "radix-ui"` — not just trusting the first `add` run.
  `cn`'s npm history is notable and worth recording: the name was an abandoned 2013
  joke package ("Chuck Norris jokes", 2 versions, by GitHub user `rumpl`), dormant for
  13 years, then taken over by the `shadcn-ui` GitHub org in September 2026 (now at
  `github.com/shadcn-ui/cn`, published via GitHub Actions OIDC trusted publishing,
  maintainer `shadcn <m@shadcn.com>`, ~24.5M downloads/week — same order of magnitude
  as the `shadcn` CLI package itself, ~18.9M/week). This pattern (an old dormant name
  reassigned to an active org) is a legitimate, if unusual-looking, npm practice, and
  is consistent with — not contradicted by — the CLI's own live behavior. Not switched
  to a hand-written `lib/utils.ts` + `clsx` + `tailwind-merge`, since that is not what
  the currently-installed tooling generates (that pattern belongs to an older/legacy
  static registry endpoint, `ui.shadcn.com/r/styles/new-york/button.json`, which the
  installed CLI does not actually call).
- **D12** — Hardened `packages/shared`'s build so a stale/missing `dist` can't silently
  break dependents:
  - Dropped `composite`/`references` (TS project references) from
    `packages/shared/tsconfig.json` / `apps/api/tsconfig.json` and set
    `incremental: false` on shared's build. Root cause: `composite: true` implies an
    incremental `.tsbuildinfo` cache, and that cache can go stale relative to the
    actual filesystem (e.g. `dist` deleted independently of the cache file) — TypeScript
    then wrongly skips re-emitting because the cache says it's already up to date.
    Reproduced during verification: deleting `dist` but leaving a pre-existing
    `tsconfig.tsbuildinfo` caused `pnpm --filter @growspark/shared build` to report
    success while writing nothing, and `apps/api`'s typecheck then failed with
    "Cannot find module '@growspark/shared'". Disabling incremental compilation for
    this small package removes the possibility entirely; the perf cost of a full
    rebuild is negligible for three small files.
  - Root `build`, `typecheck`, `lint`, and `test` scripts now all run
    `pnpm --filter @growspark/shared build` first, unconditionally, before the
    recursive `pnpm -r <script>` — not relying solely on pnpm's topological ordering
    of the same script name across packages (which doesn't help `typecheck`/`lint`/
    `test`, since those scripts don't build shared themselves).
  - Added a root `"prepare"` script (same build command) as a second safety net that
    fires automatically after any `pnpm install`.
  - `packages/shared` gained a `"dev": "tsc -p tsconfig.json --watch
    --preserveWatchOutput"` script, so the root `pnpm dev` (`pnpm --filter
    @growspark/shared build && pnpm -r --parallel dev`) builds shared once up front
    (avoiding a startup race with `apps/api`'s `tsx watch`) and then keeps rebuilding
    it on every source change. Verified `tsx watch` auto-restarts on the resulting
    `dist` change — no manual rebuild needed during `pnpm dev`.
  - Verified end-to-end: deleted `node_modules`, `packages/shared/dist`, and
    `apps/web/.next` repo-wide, ran `pnpm install --frozen-lockfile`, then `pnpm
    typecheck && pnpm lint && pnpm test` with no manual steps — all passed.
- **D13** — Same-organisation integrity (e.g. a `Deal.companyId` actually belonging
  to the same `organizationId` as the deal itself) is **not** enforced by the
  database. Postgres composite foreign keys were deliberately not used for this.
  It will be enforced at the service layer instead (tested Day 6, per the package
  1.2 brief). This is a conscious scope boundary for the schema package, not an
  oversight — every table still gets its own `organization_id` NOT NULL column +
  single-column FK to `organizations`, just not a composite FK tying it to each
  parent row's organisation.
- **D14** — Schema/migration amendments made at Phase A approval time (schema was
  never applied, so the unapplied `20261118201529_init` migration folder was
  deleted and regenerated as `20261118202744_init` rather than patched):
  - Added indexes: `LeadStatusHistory`/`DealStageHistory` each gained
    `(organizationId, <parent>Id, createdAt)` for efficient "history for this
    record, newest first" queries. `Lead` gained `(organizationId, ownerId)`
    and `(organizationId, sourceId)`. `WebsiteSubmission` gained
    `(organizationId, leadId)`.
  - `DealContact`'s plain `(organizationId)` index was replaced with
    `(organizationId, contactId)` — more useful for "which deals is this
    contact on" lookups, and `organizationId` alone was a weak index (low
    cardinality, every row in the table shares one of a handful of values).
  - Added uniques: `Pipeline` now has `(organizationId, name)` and
    `PipelineStage` now additionally has `(organizationId, pipelineId, name)`
    alongside its existing `(organizationId, pipelineId, position)` — so the
    seed (and any future pipeline setup) can safely upsert by name, not just
    by position.
  - `leads_has_email_or_phone` and `deals_lost_requires_reason` were tightened
    from "IS NOT NULL" to `NULLIF(btrim(col), '') IS NOT NULL` — an
    empty-string or whitespace-only value no longer satisfies either CHECK.
  - Added `users_email_lowercase` (`email = lower(btrim(email))`) — enforces
    the brief's "emails stored lowercased and trimmed" rule at the database
    level, not just application convention.
  - Added not-blank CHECKs on `companies.name`, `contacts.first_name`,
    `leads.first_name`, `deals.name`, `activities.subject` — required text
    fields can no longer be empty/whitespace-only strings, closing a gap the
    original schema left open (NOT NULL alone permits `''`).
  - **`id` is not the only client-generated column**: `updatedAt` (`@updatedAt`)
    is also set by Prisma Client on every write, not by a database trigger or
    `DEFAULT` — confirmed by the generated migration SQL, which has no
    `DEFAULT` clause on any `updated_at` column (only `created_at` gets
    `DEFAULT CURRENT_TIMESTAMP`). Any raw-SQL insert/update (including the
    Phase B constraint tests) must supply both `id` and `updated_at` itself.
- **D15** — Package 1.2 policy summary (consolidating choices already made
  above, plus a few new ones, since the brief asked for all of these recorded
  together):
  - **Lead contactability**: a lead must have a non-blank `emailNormalized`
    or `phoneNormalized` (`leads_has_email_or_phone`, D14) — enforced at the
    database, not just application validation, because leads can be created
    from several paths (manual entry, website submissions, imports) and the
    rule must hold regardless of which path skips application-level checks.
  - **Loss reasons are not a table.** `LOSS_REASONS` lives in
    `packages/shared/src/loss-reasons.ts` as a fixed `const` tuple (Price,
    Competitor, No budget, No decision, Timing, Not a fit, Unresponsive,
    Other) plus a Zod enum derived from it (`lossReasonSchema`). `deals.lost_reason`
    stays a plain `text` column — this list is closed/fixed per the brief, not
    something an admin configures per-organisation (unlike `LeadSource`, which
    *is* a real table because sources vary per organisation), so a shared
    constant is simpler than a table + FK for no behavioural benefit.
  - **snake_case mapping**: every table name is the model's plural snake_case
    form via `@@map` (`LeadStatusHistory` → `lead_status_histories`); every
    column is its field's snake_case form via `@map`. Enum *type* names are
    snake_cased too (`LeadStatus` → `lead_status`); enum *values* are left
    as-is (`NEW`, `CONVERTED`, …) — the brief only specified mapping for type
    names.
  - **Enum policy**: only the 8 enums the brief lists exist as real Postgres
    enum types. Every other categorical-looking field named in the brief
    (`lifecycleStatus`, `dealType`, `industry`, `employeeSize`,
    `purchaseTimeline`, `department`, `formType`, `lostReason`) is a plain
    `text` column, validated later by a Zod schema in `packages/shared`, not
    the database. This keeps adding a new, say, industry value a
    zero-migration change.
  - **Extra normalised columns**: `Contact` carries `emailNormalized`/
    `phoneNormalized` and `Company` carries `nameNormalized` purely so lookups
    and de-duplication can index/compare on a canonical form (lowercased,
    trimmed, phone-formatted) without repeatedly recomputing it from the raw
    user-entered `email`/`phone`/`name`. The normalisation logic itself is
    application code (not written yet); these columns are just where its
    output lives.
  - **Same-organisation integrity**: service-level, not a composite FK — see
    D13.
  - **UUID choice**: `uuid(7)` (time-ordered UUIDs — better index locality
    than random `uuid(4)` for a PK that's also usually the insertion/sort
    order) generated by **Prisma Client**, not the database (D14) — there is
    deliberately no `gen_random_uuid()` default in the migration SQL.
  - **Seed rules**: `apps/api/prisma/seed.ts` refuses to run when
    `NODE_ENV=production`; the two demo users' passwords come only from
    `SEED_ADMIN_PASSWORD`/`SEED_STAFF_PASSWORD` (no default in code, dev-only
    values in `.env.example`), hashed with `@node-rs/argon2`'s default
    (Argon2id). The organisation is found-or-created by name (it has no
    unique key); users, lead sources, the pipeline, and its stages are all
    upserted on their real unique keys — safe to run any number of times,
    verified by `tests/schema/seed.test.ts` running it twice and comparing
    row counts.
  - **Prisma 7 + driver adapters surfaces a different error code than classic
    Prisma for CHECK constraints**: `P2004` ("a constraint failed on the
    database") is the code older Prisma docs describe; empirically, with
    `@prisma/adapter-pg` in Prisma 7, a CHECK violation instead comes back as
    `PrismaClientKnownRequestError` with **`code: 'P2039'`** ("Database
    error"), `meta.driverAdapterError.cause.originalCode` holding the raw
    Postgres SQLSTATE (`23514`), and the constraint name inside `.message`.
    Unique violations are still `P2002`, and FK/RESTRICT violations are still
    `P2003`, both as classic Prisma docs describe. Verified directly (not
    assumed) before writing any test assertion — see
    `tests/schema/helpers.ts`'s `PG_ERROR` constants. Anyone writing
    production error-handling code against this schema needs to know to
    check `P2039` for CHECK violations, not `P2004`.
  - **`prisma migrate reset` is intentionally not an automated test.** Prisma
    7's CLI refuses to run it when it detects an AI agent invoking it,
    requiring explicit human consent each time. A one-time manual
    verification against `crm_test` (with that consent) confirmed a fresh
    database migrates cleanly from zero. The repeatable version of that check
    lives in `apps/api/scripts/db-verify-fresh.ts` (`pnpm db:verify-fresh`) —
    a human runs it before releases; it is deliberately **not** part of
    `pnpm test`, so routine test runs never drop `crm_test`.
- **D16** — Package 1.3 dependencies (both pre-approved by the brief; exact
  versions pinned, current npm "latest" at the time):
  - **`cookie@2.0.2`** (direct dependency of `apps/api`, not just express's
    transitive one at `0.7.2`): used directly for the session cookie's
    serialize/parse instead of the `cookie-parser` middleware, for full
    control over the exact flags (httpOnly, SameSite=Lax, Secure
    conditional on NODE_ENV, Max-Age). **cookie@2.x renamed its exports**:
    there is no `serialize`/`parse` in this major version — the real exports
    are `stringifySetCookie`/`parseCookie` (verified against its generated
    `.d.ts`, not assumed from memory of the classic API).
  - **`express-rate-limit@8.7.5`**: two independent limiters for login
    (per-normalised-email, and a global flood ceiling — see D23 for why
    there is no per-IP limiter), each with its own `MemoryStore` instance so
    counts never cross-contaminate. v8's options use `limit` (not the old
    `max`), a named `rateLimit` export (not default), `skipSuccessfulRequests`
    (counts only 4xx/5xx responses), and a `resetAll()` method on
    `MemoryStore` — used by `resetLoginRateLimiters()`
    (`apps/api/src/lib/rate-limit.ts`) to give every test a clean rate-limit
    slate, the same principle as `resetDatabase()` (D-in-PROJECT-STATE
    §0.5).
- **D17** — `@node-rs/argon2`'s library defaults (verified by inspecting its
  generated `.d.ts` and by generating a real hash): algorithm **Argon2id**,
  version `0x13`, memory cost **19456 KiB**, time cost **2**, parallelism
  **1**, output length **32 bytes**. Used as-is, no custom `Options` passed to
  `hash()`/`verify()`. The login timing-defense dummy hash
  (`apps/api/src/lib/password.ts`) is a fixed, hard-coded PHC string
  generated once with these same defaults — not computed at every process
  start — so startup is deterministic and an unknown-email login still pays
  one real argon2 verification, equalising response time against a
  known-email wrong-password attempt.
- **D18** — Body-parser (`body-parser@2.4.0`, via `express.json()`) error
  shapes, verified empirically (a controlled script, not assumed): a
  malformed JSON body throws with `{ status: 400, type:
  'entity.parse.failed' }`; an oversized body throws with `{ status: 413,
  type: 'entity.too.large' }`. Both status codes map to the single error
  code `BAD_REQUEST` in the central handler, per the brief's own table (400 /
  415 / 413 all share that one code, only the status differs).
- **D19** — Express 5's internal route-tree shape, used only by the
  route-registry test's auditor (`apps/api/tests/helpers/route-audit.ts`),
  verified empirically against the installed `express@5.3.0` (not part of
  `@types/express`'s public surface, and different from Express 4):
  - The route tree lives at **`app.router.stack`**, not Express 4's
    `app._router.stack`.
  - Each layer carries a **`rawPath`** string — the path segment it was
    mounted at — so a full path is reconstructed by concatenating `rawPath`
    down to each leaf `route` layer.
  - `req.query` is defined via **`defineGetter` with no setter**
    (`node_modules/express/lib/request.js`) — assigning to it throws under
    ESM's always-strict mode. `validateRequest`
    (`apps/api/src/middleware/validate.ts`) therefore writes a validated
    query to `req.validatedQuery` instead of overwriting `req.query`;
    `req.body` and `req.params` have no such restriction and are overwritten
    directly with the parsed/normalised value.
- **D20** — `enforceOriginAndContentType`
  (`apps/api/src/middleware/csrf.ts`) only requires `Content-Type:
  application/json` when the request actually carries a body (`Content-Length
  > 0` or `Transfer-Encoding` present) — not unconditionally on every
  POST/PUT/PATCH/DELETE. Found during package 1.3 verification: a bodyless
  write (logout) legitimately has no Content-Type header at all from a real
  `fetch()` call with nothing to send, and the original unconditional check
  would have 415'd every logout. The Origin check (which still runs
  unconditionally) is what actually defends against cross-site forgery here —
  a browser never lets script forge its own Origin header, body or no body —
  so this relaxation does not weaken CSRF protection.
- **D21** — **Next.js's `rewrites()` proxy does not forward the real client's
  IP.** Verified empirically (a throwaway raw HTTP server swapped in on port
  4000, hit once directly and once through the `localhost:3000` → `/api/*`
  proxy): a direct request's headers are whatever the caller sent; a request
  that went through Next's rewrite carries no `X-Forwarded-For` and no
  `X-Forwarded-Proto` at all (only `X-Forwarded-Host`), and the TCP peer the
  API sees is the Next.js server process itself (`::1` in dev), never the
  original browser. Consequence: **every browser request that reaches the
  API through the web app's proxy looks like it comes from the same
  address**, so a per-IP limiter here would, in the real browser → Next.js →
  API path, already be one shared counter across every user of the app, not
  a genuine per-client-IP limit (the per-email limiter is unaffected — it
  does not depend on IP). `TRUST_PROXY` stays `false` in this architecture,
  since there is nothing genuine to trust: trusting a Next-forwarded
  X-Forwarded-For would trust a header Next itself doesn't even set.
  **Addressed by D23**: rather than keep a per-IP limiter that was
  effectively already global, the login rate limiting was redesigned around
  that reality instead of hiding it. Genuine per-client-IP limiting needs
  the real client IP to reach this process — a deployment-architecture
  question (e.g. a reverse proxy in front of both apps that sets
  X-Forwarded-For, which Next would then need to forward downstream too),
  revisit then; the intake API in Day 5, called server-to-server and not
  through this proxy, is unaffected either way.
- **D22** — `NODE_ENV=test` during `pnpm test`: vitest sets this itself
  before any test file loads; `tests/setup.ts`'s `process.loadEnvFile`
  (which loads `NODE_ENV=development` from `.env`) does **not** override it,
  because `process.loadEnvFile` never overrides an already-set env var (the
  same behaviour already recorded for `TEST_DATABASE_URL`/`DATABASE_URL`).
  Confirmed by observing `env.NODE_ENV` resolve to `'test'` in a real test
  run. The logger (`apps/api/src/logger.ts`) now uses this to set its level
  to `silent` in tests, so `pnpm test` output isn't drowned in per-request
  log lines — purely cosmetic, no behavioural effect.
- **D23** — Package 1.3b-1: replaced the per-IP login limiter with a global
  flood ceiling, and made both remaining limiters count failed attempts
  only, per direct instruction after reviewing D21:
  - **Per-email limiter** (`loginEmailRateLimiter`): unchanged threshold (10
    per 15 minutes per normalised email), but now with
    `skipSuccessfulRequests: true` — a correct login is never counted,
    however many times in a row. A failed attempt is express-rate-limit's
    own definition of "failed": any response with status ≥ 400, which
    includes a wrong password, an unknown/inactive-user generic 401, *and* a
    422 validation failure (a malformed login body still looks like a
    credential-probing attempt and is deliberately not exempted).
  - **Global flood ceiling** (`loginGlobalFloodLimiter`, default 50 per 15
    minutes): replaces the per-IP limiter outright rather than keeping it
    under a misleading name. Built by `createGlobalLoginFloodLimiter(ceiling)`
    — a factory, not a module-level constant, specifically so tests can
    build an isolated instance with a low ceiling (verified with 3) without
    touching the real production limiter's configuration or threshold.
    Labelled "global flood ceiling" in both the code and here, not
    "per-IP" or "rate limiter" alone, so its real scope is never ambiguous
    to a future reader.
  - **Real per-IP limiting is deferred, not abandoned.** It needs the true
    client IP to reach this process, which (per D21) it currently does not
    when traffic comes through the Next.js web app. Revisit at deployment,
    once the actual network path in front of both apps is known (e.g. a
    reverse proxy that sets X-Forwarded-For *and* a Next.js config that
    forwards it through its own rewrite, or terminating the proxy
    differently).
  - `CreateAppOptions.trustProxy` (the test-only override added in package
    1.3 purely to simulate two different client IPs for the now-removed
    per-IP isolation test) was removed as dead code — `createApp()` again
    takes `TRUST_PROXY` only from `env`, which is still the correct,
    deployment-configurable source of truth for the real setting.
- **D24** — Package 1.3b-2: `pnpm dev` could hang with apps/api's `tsx watch`
  never binding its port and producing zero output (not even an error) —
  reproduced reliably, then root-caused with a sequence of isolated tests
  rather than guessed at:
  1. First hypothesis (wrong, but real and worth fixing anyway): `packages/shared`'s
     `tsc --watch` always does a full, unconditional first-pass compile —
     `incremental` is off on `tsconfig.json` (D12) — even though the root
     `dev` script had just built it a moment before via a plain `tsc`. That
     redundant first-pass write to `dist/*.js` lands while apps/api's
     `tsx watch` is also just starting, and — empirically — a restart that
     lands during `tsx watch`'s own startup window can hang rather than
     recover (a restart after full startup, proven separately, always
     recovers cleanly). **Fixed in isolation first** (verified by watching
     `dist/index.js`'s mtime across a `tsc --watch` start with a pre-warmed
     cache: unchanged, versus always-rewritten without one):
     `packages/shared` gained `tsconfig.watch.json` (extends `tsconfig.json`,
     re-enables `incremental` with its own `tsBuildInfoFile`,
     `tsconfig.watch.tsbuildinfo` — already covered by the existing
     `*.tsbuildinfo` gitignore entry) and a `dev:prepare` script
     (`scripts/clean-watch-cache.mjs` deletes that one cache file
     unconditionally, then runs `tsc -p tsconfig.watch.json` once) that the
     root `dev` script now runs instead of the plain `build` as its
     prebuild step. Because `dev:prepare` and `dev` (now `tsc -p
     tsconfig.watch.json --watch`) share that cache, and the cache is always
     freshly regenerated immediately beforehand, `tsc --watch`'s first pass
     correctly sees nothing changed and does not rewrite `dist` at all — the
     race trigger is removed, not just raced-around. Deleting the cache
     unconditionally first avoids resurrecting D12's exact bug (a stale
     cache surviving a hand-deleted `dist`) for this new file.
  2. **Real root cause**: with that fix applied, the hang still reproduced —
     with *no* restart line in the log at all. Isolated further:
     `pnpm --filter api run dev` alone always worked; `pnpm --filter api -r
     --parallel dev` *alone* (one package, through the `-r --parallel` code
     path) hung exactly the same way; two independently-spawned `pnpm
     --filter <pkg> run dev` processes (no `-r`, no `--parallel` — the moral
     equivalent of a developer opening two terminal tabs) always worked.
     Conclusion, confirmed by elimination rather than inferred:
     **pnpm's own `-r --parallel` scheduler breaks `tsx watch`'s child
     process startup on this machine** — it is not about shared, not about
     timing, not about which or how many packages are in scope.
  - **Fix**: `scripts/dev.mjs` (new, root-level, Node built-ins only —
     `child_process` + `readline`, no new dependency) spawns
     `packages/shared`, `apps/api` and `apps/web`'s `dev` scripts as three
     independent `pnpm --filter <pkg> run dev` children (not through `pnpm
     -r`), forwarding and prefixing each one's stdout/stderr itself so the
     interleaved-output readability of the old `--parallel` output is kept.
     The root `dev` script now runs `... && node scripts/dev.mjs` as its
     final step. Child cleanup uses `taskkill /PID <pid> /T /F` (not a plain
     `child.kill()`), because each child is itself a multi-process tree
     (`pnpm` → `tsx`/`tsc`/`next` → their own spawned children) that a
     single non-tree kill would not reliably stop on Windows.
  - **Verified**: from a cold state (no node processes, ports 3000/4000
    free), `pnpm dev` started cleanly five times in a row — `/health` on
    :4000 and `/` on :3000 both answering within 10–22 seconds each time —
    and, once up, editing `packages/shared/src/roles.ts` produced exactly
    one clean `tsx watch` restart (`[tsx] change in .../dist/roles.js
    Restarting...` → a fresh `"api listening"` line, new PID) with `/health`
    answering immediately after. Every run's full process tree was
    confirmed gone (no leftover `node.exe`, ports free) before the next run
    started.
- **D25** — Package 1.4 notes:
  - **Last-Admin enforcement uses a raw `SELECT ... FOR UPDATE`**
    (`apps/api/src/modules/users/users.service.ts`,
    `assertNotLastActiveAdmin`), not Prisma's query builder — there is no
    builder API for row locking. Locks every currently-active Admin row for
    the organisation (not just the target), so two concurrent
    demote/deactivate attempts against different Admins genuinely serialize
    at the database rather than racing; verified with a real concurrency
    test (two Admins demoted at once, exactly one succeeds, exactly one
    active Admin remains). The raw query casts to the Postgres enum type by
    its mapped name, `role` (from `@@map("role")` on the `Role` enum, per
    D15), e.g. `role = 'ADMIN'::role`.
  - **A query-string boolean must not use `z.coerce.boolean()`** —
    `Boolean("false")` is `true` in JS, so `z.coerce.boolean()` would accept
    `isActive=false` and produce `true`. `packages/shared/src/common.ts`'s
    `booleanQueryParam` instead validates against the literal strings
    `"true"`/`"false"` and transforms explicitly.
  - **Sort convention**: `sort=<field>:asc|desc`, validated against a perresource field whitelist (`sortQuerySchema`, `packages/shared/src/
    common.ts`) — an unlisted field or malformed value is a 422, never
    silently ignored or silently sorted by something else.
  - A single `PATCH /users/:id` writes one audit row, not two, even when
    both `name` and `role` change in the same request: `user.role_changed`
    (with `oldRole`/`newRole` in metadata) takes priority over
    `user.updated` when role is among the changed fields, since the brief's
    metadata shape ("changed field names and old/new role") implies one
    row per update, not one per field.
  - `createTestTenant()`/`createTwoTestTenants()` (built in package 1.2c,
    ahead of needing them) turned out to be exactly what this package's
    last-Admin and isolation tests needed, unchanged.
