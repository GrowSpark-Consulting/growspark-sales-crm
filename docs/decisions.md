# Decisions

Record of approved architectural decisions for the Sales & CRM project. Each entry
is a decision made once and not re-litigated without a new entry.

Numbering is append-only starting at D1; **D3 and D5 do not exist** (never
assigned in this file — presumably reserved in the user's own separate
planning roadmap, which uses different decision IDs than this file). Every
entry from D1 through D29 was made on **2026-11-19** — the entire Day 1 of
the project's 7-day plan happened on one calendar date — individual dates
are only called out inline where a specific fact (a version check, a doc
read) was itself dated for traceability.

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
- **D26** — Package 1.5 (web shell, login, Users page):
  - **No `proxy.ts`/`middleware.ts` was written, deliberately.** Next 16
    renamed `middleware` to `proxy` (confirmed in the installed version's
    own docs,
    `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`)
    and explicitly recommends against relying on it. Per the brief, the API
    is the only real access control; `AuthGuard`
    (`apps/web/components/auth-guard.tsx`) is pure client-side navigation
    convenience built on `useMe()` — an attacker bypassing it entirely still
    hits a 401/403 at the API on every request, same as always.
  - **`lucide-react` was missing.** The shadcn CLI's `add` for
    `dialog`/`dropdown-menu`/`select`/`sonner` wrote files that import icons
    from it, but did not actually add it as a dependency — the first
    `next typegen`/`tsc` run surfaced `Cannot find module 'lucide-react'`.
    Added and pinned exactly (`1.76.0`, current npm "latest" at the time).
    `next-themes` (`0.4.6`) was pulled in correctly by the CLI for
    `sonner`'s `useTheme()` call — not a separate "UI library" choice, just
    that component's own dependency; wired with a fixed `forcedTheme="light"`
    (no toggle UI in this package) so Sonner renders correctly.
  - `@hookform/resolvers`, `next-themes`, `react-hook-form`, `sonner` were
    all added by the shadcn CLI with `^` ranges — re-pinned to the exact
    versions pnpm had already resolved (`7.0.7`/`0.4.6`/`7.92.0`/`2.0.8`),
    per this repo's no-range convention. `@hookform/resolvers/zod`'s peer
    range (`zod: "^3.25.0 || ^4.0.0"`) covers the project's `zod@4.6.7`.
  - **A `Suspense` fallback of `null` is a real blank flash, not a no-op** —
    found during this package's own curl verification (not assumed): with
    `cacheComponents: true`, `/login`'s form (behind a `Suspense` boundary
    because it reads `useSearchParams()` for the `next` redirect target) was
    entirely absent from the prerendered HTML shell when its fallback was
    `null` — curl showed a page with only the heading, no form markup at
    all, until client-side hydration ran. Fixed with a real skeleton
    fallback matching the form's shape (confirmed via curl: 5
    `animate-pulse` elements now appear in the static shell).
  - **Route group `(protected)`** holds every authenticated page
    (`/`, `/users`, `/forbidden`) behind one shared `layout.tsx`
    (`AuthGuard` + `AppShell`); `/login` and the root `not-found.tsx` sit
    outside it, unauthenticated. The route group requires removing the
    original `app/page.tsx` (the 1.1-era health-check Home page) — it would
    otherwise collide with `app/(protected)/page.tsx` at the same `/` URL.
  - Server-side pagination/filtering for the Users table reuses the exact
    query shape package 1.4's API already expects (`page`, `pageSize`, `q`,
    `role`, `isActive`) — no new list-helper abstraction introduced on the
    frontend; TanStack Query's `placeholderData: (prev) => prev` keeps the
    table showing the previous page while a new one loads, instead of
    flashing empty.
  - API errors are deliberately split two ways, per the brief: a 422's
    field-level details go onto the form inline (`form.setError`); 409
    `LAST_ADMIN`/`CONFLICT`/401/403 render as an inline banner in the
    dialog (the user caused these, context is visible right there); 500
    `INTERNAL` (or an unrecognised code) and a plain network failure report
    as a toast carrying the request id instead — there's no specific field
    or known cause to point at for those. One shared helper,
    `handleApiFormError` (`apps/web/lib/handle-form-error.ts`), implements
    this split once rather than duplicating it across four dialogs.
- **D27** — Package 1.6 (Grow Spark design system applied to `apps/web`):
  - Source of truth was `docs/design-system/` (README.md, tokens.css,
    `components/*/README.md`, `components/bundle.css`) — all present, none
    missing, so nothing was worked around.
  - **Theming switched from `attribute="class"`/`forcedTheme="light"`
    (D26) to `attribute="data-theme"`, `defaultTheme="system"`,
    `enableSystem`** — matches the design system's own documented
    convention (`<html data-theme="light|dark">`) instead of inventing a
    parallel one. The Light/Dark/System toggle lives in the user menu
    (`DropdownMenuRadioGroup`), per the brief.
  - **`apps/web/app/design-tokens.css` is a verbatim copy of
    `docs/design-system/tokens.css`**, imported once from `globals.css`.
    Nothing in app code may declare a new hex value — every colour,
    radius, shadow, size and font flows from this file through Tailwind
    v4's `@theme inline` block in `globals.css`, which maps every shadcn
    semantic variable (`--color-background`, `--color-primary`,
    `--color-destructive`, `--color-sidebar`, etc.) to a GS token.
  - **shadcn's structural `accent` and GS's brand `accent` (clay) are not
    the same thing and are not merged.** shadcn/Radix use `--color-accent`
    internally as a generic hover/highlight fill for menu and select
    items; GS's `accent` is "brand moments only... not for buttons" and
    must stay rare. Mapping GS's clay onto shadcn's accent would have
    painted every dropdown/select hover state clay. Resolution: shadcn's
    `--color-accent`/`--color-accent-foreground` now point at GS's own
    `surface-hover`/`ink` (its documented neutral hover fill); GS's actual
    brand clay gets distinct `--color-brand-accent*` names, used only at
    deliberate call sites (sidebar product chip, the `accent` Badge tone).
    `accent` is never used for a Button variant.
  - **`@custom-variant dark` now targets `[data-theme="dark"]`, not
    `.dark`.** Several shadcn-generated components ship baked-in
    `dark:*` utilities (e.g. `button`/`input`/`select`/`badge`). Removing
    the custom-variant override entirely (rather than repointing it) would
    have let those utilities fall back to Tailwind's default
    `prefers-color-scheme` media query, fighting the app's own
    `data-theme` toggle whenever the OS theme and the in-app choice
    disagree.
  - **Modal/drawer scrim is `bg-ink/40`, not `bg-black/50`.** README §4
    ("Elevation") specifies the scrim as "`ink` at 40% opacity" literally;
    `components/ui/dialog.tsx`'s overlay was the one remaining hard-coded
    `black` in the app and is fixed to match.
  - **Button variants remapped, not renamed**, so every existing call site
    (`variant="outline"`, `"secondary"`, `"ghost"`, `"destructive"`) kept
    working with no call-site changes: `outline`/`secondary` both render
    the Button README's one "Secondary (default)" bordered style (the
    spec has no third bordered variant); `destructive` is now an **outline**
    recipe (`bg-surface border-danger text-danger`, hover `bg-danger-soft`)
    instead of `bg-destructive text-white` — the old recipe's `text-white`
    was a literal, non-token colour and violated "never hard-code hex/pure
    white or black" on its own. Sizes use the design system's named
    control tokens directly (`h-(--control-sm|md|lg)`) rather than
    Tailwind's numeric scale, since GS's sizes are explicitly named tokens
    the scale only coincidentally lines up with.
  - **Badge's variant set was replaced**, not extended: shadcn's
    `default/secondary/destructive/outline/ghost/link` don't match how the
    Badge README actually uses colour (status tones: `success`/`warning`/
    `danger`/`info`/`accent`, always dot + word, never colour alone). The
    one existing call site (`users/page.tsx`'s Active/Inactive badge) was
    updated to `success`/`default` accordingly.
  - **Alert kept the `destructive` variant name** (all five existing call
    sites use it) but it now renders the Alert README's danger tone
    (`bg-danger-soft`, icon `text-danger`) instead of a flat destructive
    fill; `role` is `"alert"` for `destructive`, `"status"` otherwise, per
    the README.
  - **AppShell's page title is a flat pathname → title lookup**
    (`PAGE_TITLES` in `apps/web/components/app-shell.tsx`), not derived
    from the route tree — there are only 3 protected routes today. Revisit
    once more pages land; flagged in-code as a known limitation, not
    hidden.
  - Removed the per-page `<h1>` from `/`, `/users` and `/forbidden` — the
    design system's layout puts the page title in the 56px top bar, not
    in page content, so keeping both would have shown it twice.
  - **`vitest@5.1.1` added to `apps/web`** (same pinned version already in
    `apps/api`) so the new INR/date/time formatters
    (`apps/web/lib/format.ts`) could ship with real unit tests instead of
    the placeholder `echo` test script — confirmed with the user before
    adding, per this file's no-dependency-without-asking rule. Config is
    `apps/web/vitest.config.mts` (`.mts`, not `.ts` — Vite's native config
    loader otherwise warns about ESM syntax loaded as CommonJS in a
    package with no `"type": "module"`), with one alias (`@` → the web
    package root) mirroring `tsconfig.json`'s existing path alias so tests
    import the same way app code does.
  - **INR formatting**: `formatINR` uses `Intl.NumberFormat("en-IN")` for
    Indian digit grouping only (no `style: "currency"`) and prepends
    `"₹ "` itself, since `Intl`'s own currency formatting in `en-IN` does
    not reliably produce the specific "₹ " + grouped-digits shape the
    brief asked for. `formatINRCompact` switches to `L`/`Cr` suffixes at
    exactly one lakh (1,00,000) and one crore (1,00,00,000), falling back
    to the full grouped form below one lakh (nothing to compact yet).
    Dates use `Intl.DateTimeFormat("en-GB", { day, month: "short", year })`
    (→ "19 Nov 2026"); times use `Intl.DateTimeFormat("en-US", { hour,
    minute: "2-digit", hour12: true })` (→ "2:30 PM") — `en-US` specifically
    for reliably upper-cased `AM`/`PM`.
  - Login's `Input`/`Button` use `control-lg` (44px) via explicit
    `className` overrides (`h-(--control-lg)`), not a new component size
    baked into every input — the brief scopes 44px to login/mobile
    specifically, every other control stays `control-md` (36px).
  - Console-clean on `/login` and `/` after the hydration fix
    (`suppressHydrationWarning` on `<html>`, added per this package) was
    verified via `curl` against the running dev server — the SSR payload
    confirms `suppressHydrationWarning: true` is actually reaching
    `<html>` and no server-side exception markers are present — not via a
    live browser console, since no browser-automation tool is available in
    this environment. The full visual/console check is in
    `docs/MANUAL-TEST-DAY1.md` §15 (renumbered from §12 in package 1.7) for
    the user to confirm directly.
- **D28** — Package 1.7 (search box pattern, session expiry, Cache
  Components validation):
  - **`SearchInput` (`apps/web/components/ui/search-input.tsx`)** replaces
    the Users page's separate `Input` + "Search" `Button`: a magnifier
    icon inside the field runs the search (same as Enter), and a clear
    `x` appears once there's text, clearing it **and** re-running the
    search with an empty value (not just emptying the text box and
    leaving stale filtered results on screen). Built as a thin wrapper
    around the existing `Input` (reusing its `gs-input` styling, not a new
    primitive) so Leads/Companies/Contacts can reuse it unchanged. The
    search value was never actually reflected in the URL before this
    package (checked — `apps/web/app/(protected)/users/page.tsx`'s `q`/
    `page`/`role`/`status` are plain `useState`, not `useSearchParams`),
    so "keep the search value in the URL as before" meant: don't regress
    anything, not: add new URL-sync behaviour that didn't exist. Flagged
    here rather than silently expanding scope.
  - **Global 401 handling lives in `apps/web/lib/api-client.ts`, not in
    TanStack Query's `QueryCache`/`MutationCache` hooks.** Several
    mutations in this app (`users/page.tsx`'s deactivate/reactivate,
    the dialogs' direct `apiPost`/`apiPatch` calls) are plain awaited
    function calls, not `useMutation` — a `QueryCache`/`MutationCache`
    `onError` config would miss every one of them. `apiFetch` itself now
    calls a module-level listener (`onUnauthorized`/registered by the new
    `SessionExpiryHandler`) on any `res.status === 401`, so it fires for
    literally every `apiGet`/`apiPost`/`apiPatch` call in the app,
    regardless of how it was invoked.
  - **`SessionExpiryHandler` (mounted once in `providers.tsx`, inside both
    `QueryClientProvider` and `ThemeProvider`) is the one place that
    clears the cache and redirects.** Two guards prevent a redirect loop:
    a synchronous `redirectingRef` (so a burst of parallel requests
    failing together produces exactly one redirect, re-armed on the next
    pathname change) and an explicit no-op while `pathname === "/login"`
    — necessary because `POST /auth/login` itself returns **401** on a
    wrong password (`auth.service.ts`'s `UNAUTHENTICATED`), which is a
    normal, expected, inline-handled outcome on the login page itself,
    not a session expiry.
  - **`AuthGuard`'s existing redirect-on-401 (from `useMe()`'s own error
    state, added in package 1.5) was left as-is, not removed.** It's now
    partly redundant with `SessionExpiryHandler` for the "/me itself
    returns 401" case, but the two compute the same destination and
    `router.replace` to an unchanged URL is a no-op — not worth the risk
    of touching tested first-paint-redirect behaviour to deduplicate it.
  - **Revalidation**: `useMe()` now sets `refetchOnWindowFocus: true`,
    overriding the `QueryClient`'s own app-wide default of `false` (set
    deliberately in package 1.5 so data queries like `useUsersList` don't
    refetch on every tab-focus) — this one query is the exception, since
    the whole point is catching a deactivation that happened while the
    tab was unfocused. `AuthGuard` also now calls
    `queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY })` on every
    `pathname` change after the first mount (guarded by a ref so it
    doesn't double-fetch alongside `useMe()`'s own initial fetch).
  - **Tests**: `apps/web/tests/lib/api-client.test.ts` (4 tests) covers
    `onUnauthorized` with a mocked `fetch` — pure logic, no DOM needed.
    `SearchInput` and `SessionExpiryHandler` themselves are not unit
    tested: both need a DOM (`jsdom` + `@testing-library/react`), which
    aren't installed, and adding a second new testing dependency wasn't
    asked for in this package the way `vitest` itself was in 1.6 — flagged
    as a gap rather than silently added. `docs/MANUAL-TEST-DAY1.md` §13/§14
    cover both by hand, including the two-cookie-store (normal +
    incognito) scenario for session expiry.
  - **Cache Components "instant navigation" dev notice**: confirmed with
    the user (this project's earlier decision on this was not recoverable
    from `decisions.md`, `PROJECT-STATE.md`, or any stored session
    transcript, so it was asked again rather than guessed) —
    `export const instant = false` on the affected routes. Root cause,
    read from Next's own docs (`authentication-with-cache-components.md`,
    `route-segment-config/instant.md`, both bundled in the installed
    `next` package): with `cacheComponents: true`, Cache Components
    validates "instant navigation" for every Page/Default segment by
    default (`validationLevel: 'warning'`, dev-only) — i.e. it flags any
    route whose navigation can't resolve to a UI update immediately. This
    app's whole protected area reads the session client-side
    (`AuthGuard` → `useMe()`) rather than via `cookies()` + `use cache:
    private` behind a `<Suspense>` boundary (the pattern Next's own guide
    recommends for Cache Components), so it is genuinely, deliberately
    not "instant" by that definition — restructuring it onto the
    recommended pattern is out of scope for a 3-item package. Fix: one
    `export const instant = false;` on `apps/web/app/(protected)/
    layout.tsx` — the single Server Component ancestor shared by every
    protected route. Not set per-page: `instant` throws if exported from a
    Client Component, and `users/page.tsx` is one (`"use client"`, uses
    hooks directly); `page.tsx` (Home) and `forbidden/page.tsx` are
    Server Components but don't need their own export since nothing in
    their subtree opts into `instant = true` — only an ancestor `false`
    with a descendant `true` needs both set, per the "Disabling instant"
    section of Next's `instant` doc. `/login` was left untouched — it's
    outside the brief's "protected pages" scope for this fix, and it has
    its own, already-solved `Suspense` boundary (D26) for its one dynamic
    piece (`useSearchParams()`).
- **D29** — End-of-Day-1 handover: four Day 2 rules approved by the user,
  **not yet implemented** (no Lead/Company/Contact model or module exists
  yet — these govern work starting in package 2.1+):
  - **Lead status transitions**: any open (non-terminal) status may move
    to any other open status directly — no fixed linear pipeline order
    enforced between open statuses. `CONVERTED` is reachable **only**
    through the dedicated convert action (planned for Day 3, when
    Company/Contact/Deal creation-from-lead exists), never via a plain
    status-field edit. Every status change, including the eventual
    convert, writes a `LeadStatusHistory` row — this is an audit trail
    requirement, analogous to the existing `AuditEvent` rows for users
    (D25), not optional telemetry.
  - **Lead creation requires a name, plus at least one of an email or a
    phone** — not both required, but not neither. Validate this in the
    shared Zod schema (`packages/shared`), not duplicated in the API
    service and the frontend form separately.
  - **Duplicate detection warns, it never blocks.** A duplicate is an
    exact match (after normalising: lower-cased/trimmed email, digits-only
    phone, lower-cased/trimmed company name) against an existing
    email, phone, or company name within the same organisation. On a
    match, surface a warning to the user; the record **still saves** —
    this is a heads-up, not a validation failure, and must not use the
    same 422/409 error-response shape the rest of the API uses for actual
    rejections.
  - **Staff may create, edit, and archive companies, contacts, and leads**
    (same standing as Admin for these three resources specifically) — this
    was an open question going into Day 2 ("D3" in the user's own separate
    roadmap numbering, unrelated to this file's missing D3); answered yes.
    Does **not** extend to the Users module (still Admin-only, `users:manage`
    — D16/D25) or to anything deal/pipeline-related, which hasn't been
    discussed yet.
- **D30** — Notes policy for Day 2/package 2.x, decided before 2.1–2.3 started
  (no code change, a scope boundary): **no dedicated notes table is added.**
  `leads.notes` and `contacts.notes` (both already real `text` columns per
  the existing schema) remain simple internal free-text remarks fields,
  read/write like any other lead/contact field. `companies` gets **no** notes
  field at all — not present in the schema, and none is being added. Day 4
  (activities/timelines) is expected to introduce real notes-as-timeline-
  entries instead of expanding this. **Checked whether `activities` can
  already hold a Day-4-style note**, per the user's explicit ask, without
  changing the schema: yes — `activity_type` already includes `NOTE`
  alongside `TASK`/`CALL`/`MEETING` (`SCHEMA-SUMMARY.md`'s enum table), and
  the roadmap's own Day 4 plan ("Notes are created as DONE") matches the
  existing `activities_done_has_completed_at` CHECK
  (`status <> 'DONE' OR completed_at IS NOT NULL` — a note would be created
  with `status: 'DONE'` and `completedAt` set at creation time, satisfying
  the CHECK immediately). No gap found; nothing to flag for a schema
  amendment.
- **D31** — Package 2.0 (Day 1 leftovers):
  - **Thin Server Component page wrapper is now the rule for every
    `page.tsx` under `app/(protected)/`** — carries `export const instant =
    false` itself (not just inherited from the shared layout), with any
    actual client-side interactivity moved into a separate `"use client"`
    component the page renders. Applied to all three existing protected
    pages: `users/page.tsx` (previously a Client Component itself, unable to
    carry `instant` at all per Next's rule that it throws when exported from
    a Client Component) is now a thin wrapper rendering the new
    `components/users/users-page-client.tsx` (`UsersPageClient`, unchanged
    logic, just moved); `page.tsx` (Home) and `forbidden/page.tsx` stay
    Server Components with no interactivity to extract, so they simply gained
    the same `export const instant = false` directly — no artificial client
    split was introduced for static content. The layout-level `instant =
    false` (D28) is left in place too, as a safety net for any future page
    that forgets its own export, not removed in favour of the per-page one.
  - **`PasswordInput`** (`apps/web/components/ui/password-input.tsx`): a
    thin wrapper around the existing `Input`, adding a show/hide toggle
    (Lucide `Eye`/`EyeOff`, `aria-label`/`aria-pressed` reflecting state) —
    same styling, drops into react-hook-form's `{...field}` spread exactly
    where a bare `<Input type="password" />` was used before (same pattern
    `Input`/`SearchInput` already use: a plain function component, no
    `forwardRef`, relying on React 19 treating `ref` as an ordinary prop that
    flows through the `...props` spread onto the host `<input>`). Replaces
    the password field in `login-form.tsx`, `create-user-dialog.tsx`, and
    `reset-password-dialog.tsx` — all three, not just one, since the brief
    asked for every password field in the app. No new dependency: `lucide-
    react` was already pinned (D26).
  - One lint fix needed: ESLint's `@typescript-eslint/no-empty-object-type`
    rejected `interface PasswordInputProps extends Omit<...> {}` (a no-member
    interface is flagged as equivalent to its supertype) — changed to a
    `type` alias instead, which isn't subject to that rule.
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
    (140 tests, unchanged from package 1.7 — this package touched no test
    files and added no new logic needing its own test, only UI
    restructuring/wiring already covered by existing build/typecheck/lint
    gates). No process was started this package; nothing to stop.
- **D32** — Conflict found before starting 2.3, stopped and asked rather than
  choosing (per explicit instruction): the 2.3 brief says every lead status
  change writes `LeadStatusHistory` "(from, to, who, when, optional note)",
  but the actual, already-migrated `lead_status_histories` table
  (`schema.prisma` and `SCHEMA-SUMMARY.md` both confirmed) has only `id,
  organization_id, lead_id, from_status, to_status, changed_by_id,
  created_at` — no column to hold a note. **Resolved: drop the note
  entirely.** The lead status-change endpoint (built in package 2.3) takes
  only `{ status }`; `LeadStatusHistory` keeps recording from/to/who/when
  exactly as the schema already supports, with no schema change. D29's own
  wording (the original Day-2-rules approval) never mentioned a note either
  — only the later roadmap brief did — so this also resolves the discrepancy
  in D29's favour.
- **D33** — Package 2.1 (foundations: shared list helper, normalisers,
  duplicate finder, lookups):
  - **Normalisers** (`packages/shared/src/normalize.ts`):
    `normalizeEmail`/`normalizePhone`/`normalizeCompanyName`, pure functions,
    reusable by both the backend (every leads/companies/contacts write) and
    later the frontend (live duplicate hints before submit).
    `normalizeCompanyName` lower-cases, trims, collapses punctuation
    (`. , ' " & ( ) -`) to spaces, then iteratively strips a trailing
    legal-entity suffix from a fixed list (private limited, pvt ltd, pte
    ltd, ltd, llp, llc, pvt, inc, incorporated, corporation, corp, limited,
    co) — iterative because a name can stack more than one ("Acme Corp
    Inc" needs two passes). Returns `null` (never `""`) for blank,
    suffix-only, or missing input, so a normalised column stays genuinely
    empty rather than holding an empty string the database would then have
    to special-case.
  - **`LEAD_STATUSES`/`PRIORITIES`** (`packages/shared/src/lead-statuses.ts`,
    `priorities.ts`): built as `as const` tuples + `z.enum`, **not** TS
    `enum`s like `ROLES` — deliberately, because Prisma's own generated
    `LeadStatus`/`Priority` types are also string-literal unions with
    identical values, so a tuple-derived literal type is directly
    assignable to a Prisma field with no bridge cast needed (unlike `ROLES`,
    which does need `toSharedRole`/`toPrismaRole` — see D25's note on that
    pattern). `OPEN_LEAD_STATUSES` (everything except `CONVERTED`) is a
    separate, smaller tuple — D29: `CONVERTED` is reachable only through the
    Day 3 convert action, never a plain status edit, so the shared schema
    for that edit should structurally exclude it, not just validate it away
    at runtime.
  - **Duplicate finder** (`apps/api/src/lib/duplicates.ts`):
    `findDuplicateCompanies`/`findDuplicateContacts`/`findDuplicateLeads` —
    three explicit functions, not one generic one, because each queries a
    different Prisma model with a different set of normalised columns
    (Company: name only; Contact: email/phone only; Lead: all three — see
    D15's "extra normalised columns" note for why). Each takes an
    `excludeId` (so editing a record doesn't flag itself) and
    `includeArchived` (default false — a match against an already-archived
    record isn't a live duplicate to warn about). When a single row matches
    more than one field, the reported reason prioritises email over phone
    over company name (the more certain identity signal wins). Shared
    response shape: `duplicateMatchSchema` (`packages/shared/src/
    duplicates.ts`) — `{ id, reason }`, deliberately not the `{ error: {...}
    }` envelope, since D29 is explicit that a duplicate warns and never
    blocks.
  - **Shared list-query helper** (`apps/api/src/lib/list-query.ts`):
    `buildOrderBy(sort, fallback)` — the one line of the Users module's
    list-query pattern (`query.sort ? {...} : { createdAt: 'desc' }`) that
    was being hand-written per module, now a single generic helper.
    Deliberately small: `page`/`pageSize`/`sort` parsing and validation
    (unknown field -> 422) already live in `packages/shared`'s
    `pageQuerySchema`/`sortQuerySchema`, and pagination math already lives
    in `apps/api/src/lib/pagination.ts`'s `toSkipTake`/`buildPaginationMeta`
    (both from package 1.4) — this package reuses both unchanged rather than
    replacing them with a new monolithic query builder, per "reuse shared
    helpers instead of duplicating them." `users.service.ts`'s existing
    `listUsers` was left as-is (out of this package's scope) rather than
    retrofitted to use the new helper.
  - **`GET /api/v1/lead-sources`** (new `lead-sources` module): active
    sources only, ordered by `sortOrder` then `name` — not a paginated
    admin list (managing lead sources is P1 per the roadmap). Gated on
    `leads:read` (both roles already have it).
  - **`GET /api/v1/users/options`** (added to the existing `users` module,
    not a new one — it's a `/users` route): id+name of active users for
    owner pickers. Deliberately gated `auth: 'authenticated'`, not
    `users:manage` — every role that can own a record (Staff included)
    needs to populate its own owner dropdown, so this one `/users*` route
    is intentionally *not* Admin-only. Registered before `GET
    /api/v1/users/:id` in `users.routes.ts`, since Express matches routes
    in registration order and `:id` would otherwise capture the literal
    path segment `options`. This required updating
    `tests/users/registry-permissions.test.ts`'s "every `/users*` route is
    403 for Staff" sweep to exclude this one route (now asserted 200 for
    Staff instead, with its own test) — a necessary consequence of adding
    the route, not scope creep.
  - Tests: normaliser unit tests (`tests/shared/normalize.test.ts`,
    including the "stacked suffix" and "different casing/suffix variants
    normalise equal" cases); duplicate-finder tests against a real database
    (`tests/lib/duplicates.test.ts` — match-by-each-field, archived
    exclusion, `excludeId`, cross-organisation isolation, null-input
    no-ops); lead-sources list/sort/isolation/auth-required tests
    (`tests/lead-sources/list.test.ts`); a cross-organisation isolation test
    for `/users/options` added to the existing `tests/users/isolation.test.ts`.
    `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
    (149 tests: 124 carried over + 25 new, all `apps/api`; `apps/web`
    unchanged at 16). One lint fix needed:
    `normalize.ts`'s character-class regex had an unnecessary escape on
    `-` (`no-useless-escape`) — removed (a trailing `-` in a character
    class is already literal, no escape needed).
- **D34** — Package 2.2 (Companies and Contacts API):
  - **Response envelope for create/update**: `{ data, duplicates }`, via
    `companyWithDuplicatesResponseSchema`/`contactWithDuplicatesResponseSchema`
    (`packages/shared`) — `duplicates` is always present (an empty array
    when there are none), never folded into or replacing `data`, and never
    the `{ error: {...} }` shape, per D29. `GET` (list and single) responses
    carry no `duplicates` field — only a create or an update can produce a
    new candidate worth surfacing.
  - **`archived` list filter is tri-state via the existing
    `booleanQueryParam`**: omitted or `archived=false` -> only
    non-archived rows (`archivedAt: null`); `archived=true` -> only
    archived rows (`archivedAt: { not: null }`). There is no "both" mode —
    matches the brief's "archived hidden by default."
  - **Archiving an already-archived record (or restoring an active one) is
    a 404, not a no-op or a 409.** Both `archiveCompany`/`restoreCompany`
    (and the Contact equivalents) look the existing row up pre-filtered by
    the state they expect it to be in (`archivedAt: null` for archive,
    `archivedAt: { not: null }` for restore) — a mismatch means "the active
    [or archived] record you asked for doesn't exist," consistent with
    every other cross-organisation/missing-id case in this codebase using
    404 rather than a different status per situation. Covered by a test.
  - **Clearing an optional text field is `""` on `PATCH`, not `null`** —
    `blankToNull` (duplicated once per service file, not shared: it is two
    lines and the alternative was a generic helper fighting Prisma's
    per-model generated types for no real benefit) converts a submitted
    empty string to `null` in the database; omitting the key entirely
    leaves the field untouched. Relation-valued optional fields
    (`companyId`, `ownerId`) instead accept `null` directly (the schemas
    were changed to `.nullable().optional()` specifically so this works —
    `z.uuid()` alone rejects `""`, which would otherwise make "detach the
    owner/company" inexpressible through the API). Both conventions are
    deliberately different because a UUID field has no valid empty-string
    form to overload as "clear," while a free-text field does.
  - **exactOptionalPropertyTypes gotcha**: a `blankToNull` that accepted
    `string | undefined` and returned `string | null | undefined` made the
    conditionally-spread object literal's inferred property type include
    `undefined`, which Prisma's generated `*UpdateInput` types (compiled
    with `exactOptionalPropertyTypes: true`) reject — Prisma distinguishes
    "key present with value `undefined`" from "key absent" and only the
    Zod/application layer is supposed to produce the latter. Fixed by
    typing `blankToNull` as `(value: string) => string | null` and only
    ever calling it from inside a ternary that already narrowed
    `input.field` away from `undefined` — not a runtime bug, a type-level
    one, caught by `pnpm typecheck` before any test ran.
  - **Same-organisation integrity for `ownerId` (Company, Contact) and
    `companyId` (Contact) is enforced in the service**, not left to the FK
    alone: the database's plain (non-composite) FK only proves the id
    exists *somewhere*, not that it belongs to the caller's organisation
    (D13) — a real, reachable gap once Day 2 modules started writing real
    foreign keys, not just a theoretical one deferred to "Day 6" as D13's
    schema-package-era note assumed. `assertOwnerInOrg`/
    `assertCompanyInOrg` (one pair per service file, not shared — same
    reasoning as `blankToNull`) look the referenced row up scoped to
    `organizationId` first and 404 if it isn't found, before the write.
    Covered by cross-organisation tests in both modules.
  - **`lifecycleStatus` is free text, not a fixed enum** — the brief names
    the field on Contact but never enumerates its values (unlike lead
    status/priority, which the database itself constrains with a real
    Postgres enum, D15's "Enum policy"). Defaults to `'ACTIVE'` server-side
    on create, and an empty-string `PATCH` resets it back to `'ACTIVE'`
    rather than to `null` (the column is `NOT NULL` with that default, per
    `SCHEMA-SUMMARY.md`) — a judgment call, flagged here rather than
    silently invented.
  - Tests: full CRUD + archive/restore round-trip for both resources;
    Staff-can-write proof for both (the opposite of the Users module's
    Staff-blocked default, per D29); duplicate-warns-but-still-saves for
    both; blank-clears-to-null; cross-organisation 404s on every mutating
    route plus list-never-leaks; duplicate detection never matches across
    organisations; a company/owner id from another organisation is
    rejected (404) when referenced from Contact/Company create; re-pointing
    and detaching a Contact's company via `PATCH`. `pnpm typecheck && pnpm
    lint && pnpm test && pnpm build` all pass clean (187 tests: 149 carried
    over + 38 new, all `apps/api`; `apps/web` unchanged at 16).
- **D35** — Package 2.3 (Leads API):
  - **Status endpoint is a separate `POST /leads/:id/status`, not part of
    the general `PATCH`** — `updateLeadStatusSchema` takes only `{ status:
    OpenLeadStatus }` (D32: no note field), and `OpenLeadStatus`
    structurally excludes `CONVERTED` as a target (2.1's
    `openLeadStatusSchema`, D33), so submitting `CONVERTED` here is a 422,
    not a runtime check. The complementary "from" direction — a lead that
    is *already* `CONVERTED` — can't be expressed in the type system, so
    `updateLeadStatus` checks `existing.status === 'CONVERTED'` in the
    service and refuses with 409 `CONFLICT` (a state conflict, not a
    validation failure: the request body itself was well-formed). Every
    successful change writes one `LeadStatusHistory` row
    (from/to/who/when) and one audit row, in the same transaction.
  - **`requirement` and `capturedFields` are genuinely unreachable from
    `PATCH`** — not rejected, simply absent from `updateLeadSchema`'s
    shape. Zod's default (non-`.strict()`) object parsing silently strips
    any extra key a client sends for either field, so a `PATCH` containing
    `requirement` succeeds (200) and changes nothing about it — covered by
    a test that asserts the original value survives. This was a deliberate
    reading of "read-only after creation": a 422 would have implied the
    field is forbidden to *mention*, which is stricter than what "read-only"
    means for every other already-set field in this app (e.g. a user's
    `email` is likewise never accepted by `updateUserSchema`, with the same
    silent-strip behaviour, not a special error).
  - **Clearing both contact methods on `PATCH` is a clean 422, not a
    database 500.** The `leads_has_email_or_phone` CHECK (D14/D15) would
    otherwise fire as Prisma's `P2039`, which `error-handler.ts` deliberately
    leaves unmapped (a CHECK violation reaching the handler is meant to
    signal validation that should have been caught earlier — see its own
    comment). `updateLead` computes what the lead's normalised email/phone
    would become *after* applying the PATCH (untouched fields keep the
    existing row's normalised value) and throws a regular `ApiError(422,
    'VALIDATION_FAILED', ...)` itself before the write, if both would end up
    empty. Covered by a test that clears email while phone remains (200),
    then clears phone too (422).
  - **`companyId`/`ownerId`-style "detach via null" pattern from D34 is
    reused for `ownerId` here too** (Lead has no company-link field, so
    only `ownerId` needed it): `.nullable().optional()` in the shared
    schema, `owner: input.ownerId ? { connect } : { disconnect: true }` in
    the service.
  - **`GET /api/v1/leads/:id/status-history`** (new, not explicitly asked
    for in the 2.3 brief, added anyway): a thin read endpoint over the rows
    `updateLeadStatus` already writes. Day 4's planned "timeline" endpoint
    (merging activities + status + stage + conversion history) supersedes
    this eventually, but there's no reason the lead detail UI built in
    2.4–2.6 should have to wait until Day 4 to show status history that
    already exists in the database — cheap to add now, nothing to migrate
    later (Day 4 can fold this data into the richer merged view without
    removing this endpoint).
  - **`GET /api/v1/leads/duplicates`** (the "duplicate check endpoint for
    the create/edit form" the brief asked for): takes raw, not
    pre-normalised, `email`/`phone`/`companyName` query params (normalised
    server-side, same as create/update) plus an optional `excludeId` (so
    the edit form doesn't flag the record against itself). Registered
    before `GET /leads/:id` for the same Express route-ordering reason as
    `GET /users/options` (D33) — `"duplicates"` would otherwise be captured
    as `:id`.
  - **`z.iso.datetime()`** (Zod v4's dedicated ISO-datetime validator, not
    the deprecated `z.string().datetime()`) is used for `nextFollowUpAt`
    and the list's `createdFrom`/`createdTo` — verified empirically
    (`node -e` against the installed `zod@4.6.7`) that its *default* mode
    requires a trailing `Z` (UTC) and rejects both a bare local datetime
    and a `+05:30`-style offset; not widened to `{ offset: true }`, since
    every other timestamp in this app is already UTC
    (`timestamptz` columns, D13's conventions) and a frontend's own
    `Date.toISOString()` already produces exactly this shape.
  - **Same-organisation integrity for `sourceId`/`ownerId`** follows D34's
    `assertOwnerInOrg`/new `assertSourceInOrg` pattern exactly (not shared
    as a generic helper across modules — same reasoning as D34).
  - Tests: full CRUD + archive/restore; email-or-phone requirement on
    create (both directions: phone-only accepted, neither rejected);
    blank-name rejected; cross-org `sourceId` rejected; requirement/
    capturedFields immutability; the clear-both-contacts 422; Staff can
    create/edit/archive (D29); duplicate-warns-but-still-saves; the
    standalone duplicates-check endpoint (including `excludeId`); full
    status-workflow coverage (free movement between open statuses with
    history rows asserted directly against the database, `CONVERTED` as a
    target rejected with an empty history, `CONVERTED` as a starting state
    rejected with 409, an unknown status value rejected, history ordering);
    unknown sort field 422; filters (status/source/owner/priority/date
    range) and search; cross-organisation 404s on every mutating route plus
    list/duplicate-detection leakage. `pnpm typecheck && pnpm lint && pnpm
    test && pnpm build` all pass clean (215 tests: 187 carried over + 28
    new, all `apps/api`; `apps/web` unchanged at 16).
- **D36** — Package 2.3b (small backend fixes, own commit, before Day 2's UI
  packages):
  - **Archive/restore on a record already in that state is now 409, not
    404.** `archiveCompany`/`restoreCompany` (and the Contact and Lead
    equivalents) now fetch the row scoped by organisation only (no
    `archivedAt` filter in the lookup itself), then check its actual state:
    missing or cross-organisation still 404 `NOT_FOUND` (existence is never
    leaked, unchanged); found but already in the requested state is 409
    `ALREADY_ARCHIVED` (archiving an archived record) or `NOT_ARCHIVED`
    (restoring an active one) — a real, named conflict with a clear
    message, not folded into "not found." The one pre-existing test that
    asserted 404 for a double-archive (`tests/companies/crud.test.ts`) was
    updated to 409; equivalent tests were added for Contacts and Leads, and
    a new "missing id still 404, not 409" test guards the boundary between
    the two codes.
  - **Answered (read-only, no schema change): can `activities` hold a
    `NOTE` type for Day 4?** Yes — re-confirmed from `SCHEMA-SUMMARY.md`'s
    enum table and `schema.prisma`: `activity_type` already includes
    `NOTE` alongside `TASK`/`CALL`/`MEETING`, and the
    `activities_done_has_completed_at` CHECK
    (`status <> 'DONE' OR completed_at IS NOT NULL`) already matches the
    roadmap's own Day 4 plan ("notes are created as DONE" — a note would be
    inserted with `status: 'DONE'` and `completedAt` set at creation,
    satisfying the CHECK immediately). This is the same finding D30 already
    recorded before package 2.1; re-verified now because this package's
    brief asked for it again directly. Still nothing to build — Activities
    is a Day 4 module.
  - **Contact's `lifecycleStatus` stays free text and will not appear in
    the Day 2 UI.** Checked the PRD directly (13.1's Contact row names
    "lifecycle status" as a field but, like the roadmap, never enumerates
    its values anywhere in the document) — per the user's explicit rule
    ("if the PRD lists values, make it a fixed set; otherwise leave it and
    do NOT show it in the UI"), it is left as-is in the schema/API
    (already free text, defaulting `'ACTIVE'`, D34) and package 2.5's
    Contact list/form/detail screens will not surface it. Revisit if a
    later phase defines real values.
  - **New approved dependency, `apps/web` only**: `jsdom@31.0.1`,
    `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2` (a true
    peer requirement of `@testing-library/react`, pinned explicitly rather
    than left to resolve transitively) — all exact-pinned devDependencies,
    for package 2.4's component tests. `@testing-library/user-event` and
    `@testing-library/jest-dom` were deliberately **not** added — neither
    is strictly required for `@testing-library/react` to function (tests
    use `fireEvent`, already re-exported by `@testing-library/react`
    itself, and plain assertions instead of jest-dom's convenience
    matchers), and the approval was scoped to "jsdom and
    @testing-library/react (and its required companions)" specifically.
    `apps/web/vitest.config.mts` sets `test.environment: "jsdom"`
    globally (not per-file) — the two existing pure-logic test files
    (`format.test.ts`, `api-client.test.ts`) pay a small, measured jsdom
    setup cost (`apps/web` test duration rose from under 1s to ~9s, almost
    entirely "environment" time) but need no code change, and a single
    global config is simpler than per-file environment overrides for a
    test suite this size.
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
    (219 `apps/api` tests: 215 carried over + 4 new; `apps/web` unchanged
    at 16, now running under jsdom).
- **D37** — Package 2.4 (shared UI building blocks):
  - **`DataTable`** (`apps/web/components/ui/data-table.tsx`): wraps the
    existing `Table`/`TableHeader`/`TableRow`/`TableHead`/`TableBody`/
    `TableCell` (already restyled to the design system in package 1.6),
    rather than reimplementing table markup — server-side paging/sorting
    only (the caller owns the actual query; this renders what it's given
    and reports clicks via `onSortChange`/`onPageChange`), a `filterBar`
    slot, a loading skeleton (one `Skeleton` row per visible row, capped at
    8), an empty state (title + description + one action, per the Table
    README), and an error state with a Retry button. A sortable column
    header is a real `<button>` inside the `<th>` (keyboard-focusable,
    `aria-sort` on the cell) with a chevron icon showing direction, not a
    `<div onClick>`. Row-opens-record is **not** handled by `DataTable`
    itself — per the Table README ("first column is the record name... and
    opens the record"), the first column's own `render` returns a real
    Next.js `<Link>`, which is natively keyboard-accessible, rather than
    adding row-level click/keydown handling for the same behaviour.
  - **`RecordLayout`** (`apps/web/components/ui/record-layout.tsx`): header
    (title, status badge, actions) + a key-fields strip (label/value pairs
    in a bordered `surface` panel) + `Tabs` (reusing the existing, already
    design-system-restyled `Tabs` from package 1.6) — the "consistent
    tabs/sections" the PRD's §13.2 "Record detail experience" asks for
    across Leads/Companies/Contacts/Deals. Built but not yet wired into a
    real page — record detail pages are 2.5/2.6's job; only `DataTable`
    needed real-page proof per this package's brief.
  - **Pickers**: `OwnerSelect` (`components/pickers/owner-select.tsx`)
    wraps the existing `Select` over `GET /users/options` (2.1), with an
    explicit "Unassigned" option mapped to `undefined` — deliberately kept
    to *form* use (a record's own owner field, including clearing it), not
    reused for the Companies list page's owner *filter* (where "no filter"
    and "owner = nobody" are different concepts the same widget shouldn't
    conflate); the list page's filter is a plain inline `Select` instead.
    `CompanySelect` (`components/pickers/company-select.tsx`) is a small
    hand-built async combobox (debounced 300ms into `GET /companies?q=`) —
    no Combobox/Command primitive is installed (`radix-ui` ships `Select`,
    not a command palette), and adding `cmdk` for one picker wasn't judged
    worth a new dependency. Built with `role="combobox"`/`listbox`/`option`
    and arrow-key/Enter/Escape navigation. Not yet wired into a real page
    (the Lead "link to existing company" use case is part of 2.6).
  - **React Compiler ESLint gotcha, found via `pnpm lint`**: `CompanySelect`
    originally used two `useEffect`s to sync local state from a changed
    prop (`value`) and to reset `highlightedIndex` when the debounced query
    changed — both trip `react-hooks/set-state-in-effect`
    ("calling setState() directly within an effect" risks a cascading
    render). Rewritten using React's own documented alternative
    ("adjusting state during rendering" — comparing a tracked previous
    value against the current one and calling `setState` directly in the
    render body, guarded by a condition, with no `useEffect` at all).
    Functionally identical; one fewer render per prop/query change.
  - **`useListUrlState`** (`apps/web/hooks/use-list-url-state.ts`): the one
    generic piece of "filters live in the URL" — parses `page`/`pageSize`
    off `useSearchParams()` and a `setParams(updates)` that merges into the
    query string via `router.replace` (no history entry per keystroke) and
    resets `page` to 1 whenever anything *other than* `page` itself
    changes. Each page still reads its own specific filter values directly
    off the returned `searchParams` — Leads has five filters, Companies has
    one; shapes differ too much to generalise further than page/pageSize.
  - **Proof page: Companies list** (`app/(protected)/companies/`,
    `components/companies/companies-page-client.tsx`) — the one real page
    `DataTable` is wired into per this package's brief. Search (name/email/
    phone, reusing `SearchInput` unchanged), an owner filter (plain
    `Select`, not `OwnerSelect` — see above), an Active/Archived toggle,
    sortable Name/Created columns (the only two fields
    `COMPANY_SORT_FIELDS`, D33/2.2, actually allows — the table's other
    columns are deliberately not marked sortable, since clicking them would
    404/422 against the API). Links to `/companies/new` and
    `/companies/:id` are present but those routes don't exist yet
    (package 2.5) — a deliberate, temporary 404 until then, not an
    oversight. A new "Companies" sidebar entry and top-bar title were
    added; `pageTitle()` in `app-shell.tsx` now also prefix-matches
    (`/companies/:id` → "Companies"), not just the flat exact-route lookup
    from package 1.6 (still noted as a from-the-route-tree improvement to
    make eventually, per that package's own comment).
  - **`ConfirmActionDialog` moved** from `components/users/` to
    `components/ui/confirm-action-dialog.tsx` — it was already fully
    generic (any confirm-then-call-the-API action), just mis-filed under
    the one module that happened to use it first; Companies/Contacts/
    Leads archive-restore (2.5/2.6) reuse it unchanged from its new home.
  - **Component tests** (`apps/web/tests/components/`): `DataTable` (renders
    rows/columns, empty state, error state + retry, loading skeleton,
    sortable-header click, Previous/Next disabled state and page-change
    callback), `SearchInput` (Enter, magnifier click, clear button
    appearing only with text and re-searching empty, whitespace trimming),
    and `OwnerSelect` (the one picker — fetches the right endpoint, renders
    an accessible combobox trigger, and the options query is cached/shared
    rather than refetched on every prop change). **`CompanySelect` was not
    separately unit-tested** — the brief asked for one picker, and
    `OwnerSelect` was chosen as the more reliable one to test in jsdom
    (`CompanySelect`'s debounced async dropdown adds timer-mocking
    fragility a second component test wasn't worth taking on for this
    package); it will be exercised through the Lead form in package 2.6
    instead.
  - **A real `afterEach(cleanup)` was missing for `apps/web`'s component
    tests, found immediately on first run**: `@testing-library/react`'s
    automatic cleanup only self-registers when it detects vitest's
    `globals: true` (not used anywhere in this repo — `apps/api`'s own
    `tests/setup.ts` imports hooks explicitly too, same convention); without
    it, every `render()` within one test file piled up in the jsdom
    document instead of unmounting, so a later test's `getByRole` matched
    more than one element. Fixed with `apps/web/tests/setup.ts`
    (`afterEach(() => cleanup())`) wired into `vitest.config.mts`'s new
    `setupFiles`, mirroring `apps/api`'s existing setup-file pattern rather
    than inventing a new one.
  - **No `@testing-library/jest-dom` or `@testing-library/user-event`
    added** — neither is a true `@testing-library/react` peer requirement
    (tests use `fireEvent`, already re-exported by `@testing-library/react`
    itself, and plain `expect(...).toBe(...)`/`.toBeTruthy()` assertions
    instead of jest-dom's convenience matchers like `toBeInTheDocument`),
    and the approval in this session was scoped to "jsdom and
    @testing-library/react (and its required companions)" specifically —
    see also D36.
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
    (249 tests: 219 `apps/api` unchanged + 30 `apps/web`, 14 new).
- **D38** — Package 2.5 (Companies and Contacts UI):
  - **Real PRD/schema conflict found before building the Contact form,
    stopped and asked per instruction**: §13.1 lists "alternate phone
    (optional)" and "preferred communication method (optional)" as Contact
    fields; the actual `contacts` table (Day 1, already-approved schema)
    has neither column. Resolved: drop both, no schema change — the
    Contact form/detail only surfaces fields the schema actually has
    (first/last name, email, phone, job title, department, company, owner,
    location, notes; `lifecycleStatus` stays hidden too, per D36).
  - **Companies use full pages for create/edit** (`/companies/new`,
    `/companies/[id]/edit`); **Contacts use a Dialog**
    (`ContactFormDialog`) for both. Deliberately different: Company has
    ~15 fields including a multi-line address, better served by a page's
    two-column grid (Field README: "group related fields in a two-column
    grid on desktop") than a scrollable modal; Contact has fewer fields and
    is launched from two different contexts (standalone from `/contacts`,
    and "Add contact" on a Company's own Contacts tab) — a dialog needs no
    navigation away from either.
  - **Both forms validate against the *create* schema in edit mode too**
    (not the separate `update*Schema`), submitting the full field set as
    `PATCH`. `updateCompanySchema`/`updateContactSchema` make every field
    optional (so a single-field `PATCH` elsewhere, e.g. the list's inline
    archive, stays valid) — but a *form* always redisplays and resubmits
    every field, and `createCompanySchema`'s only extra requirement
    (`name` non-blank) is correct for editing too. This sidesteps a real
    `react-hook-form`/Zod generic-typing conflict entirely (see below) by
    using one schema, not two nearly-identical ones.
  - **`z.coerce.number()` (`annualRevenue`) breaks a plain
    `useForm<CreateCompanyInput>`, found via `pnpm typecheck`**: Zod v4's
    `ZodCoercedNumber<T = unknown>` defaults its *input* type parameter to
    `unknown` (verified by reading the installed `zod@4.6.7`'s own
    `coerce.d.ts`) — so the schema's pre-validation shape (`z.input`) and
    post-validation shape (`z.output`, `= CreateCompanyInput`) genuinely
    differ for that one field, and `zodResolver`'s inferred `Resolver` type
    stopped structurally matching `Control`/`UseFormReturn<
    CreateCompanyInput>` everywhere a `FormField` used it. First attempt
    (react-hook-form's own documented fix, the 3-generic
    `useForm<TFieldValues, TContext, TTransformedValues>` signature) technically
    worked but left `field.value` typed `unknown` for that one field,
    pushing the problem into every place it was read. Settled on a
    simpler fix: a form-local `companyFormSchema =
    createCompanySchema.extend({ annualRevenue: z.number()...optional()
    })` — swaps just that one field for a non-coercing validator (the
    form's own `Input` `onChange` already converts to a real number via
    `valueAsNumber`, so the field never holds a raw string to coerce from
    anyway), keeping every other field's validator identical to the shared
    schema and the whole form on one ordinary generic.
  - **Duplicate hint on company-name blur has no dedicated backend
    endpoint to call** (unlike Leads' `GET /leads/duplicates`, D35) — adding
    one wasn't judged worth it for a single blur-triggered hint. Reuses the
    ordinary `GET /companies?q=` list endpoint instead: an approximate,
    live, warn-only hint (D29); the authoritative normalised-exact match
    still runs server-side on save regardless, via the existing `{ data,
    duplicates }` response (D34). Not built for Contact fields — only
    Company name was asked for.
  - **Archive/restore reuses `ConfirmActionDialog`** (moved to
    `components/ui/` in D37) from three places per resource: the list row's
    Actions column, and the detail page's header actions — same
    confirm-then-call-the-API shape everywhere, success toasts via
    `sonner`.
  - **New `Textarea`** (`components/ui/textarea.tsx`): no shadcn-generated
    one existed yet; built to the same Field treatment as `Input` (the
    Field README explicitly lists textareas among the components sharing
    "the same height, border, radius and states"). Used for Company's
    `description` and Contact's `notes`.
  - **`stripEmptyOptionalFields`** (`lib/form-utils.ts`): react-hook-form
    initialises every text field to `""`, not `undefined`, so a submit
    always sends a key for every optional field even when left blank. Sent
    as-is, a create endpoint's `?? null` fallback (D34) only catches
    `null`/`undefined`, not `""`, so a blank optional field would be stored
    as a literal empty string instead of `null` — found by reasoning
    through the create path before it shipped, not by a failing test.
    Strips blank keys from the form payload before every Company/Contact
    submit, so "left blank" means the same thing through the UI as it
    already does when calling the API directly.
  - **`CompanySelect` inside `ContactFormDialog`** needs the linked
    company's *name* to display when editing a contact that already has
    one (the form only stores the `companyId`) — fetched via the existing
    `useCompany` hook, gated so `CompanySelect` only mounts once the name
    has actually resolved (a brief "Loading…" disabled input otherwise),
    rather than mounting it early with an empty name: `CompanySelect`'s own
    render-time-sync logic (D37) only re-syncs its input text when the
    *id* changes, not the *name*, so mounting it early with a blank name
    would have left the field stuck blank even after the real name loaded.
  - Staff has the same standing as Admin on every Companies/Contacts
    screen built this package (D29) — no admin-only gating was added,
    unlike the Users module.
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
    (249 tests, unchanged — this package was UI wiring over already-tested
    2.2 endpoints; no new automated tests were added, per the brief, which
    asked for manual verification via `MANUAL-TEST-DAY2.md` at the end of
    2.6 instead). New routes confirmed in the build output: `/companies`,
    `/companies/new`, `/companies/[id]`, `/companies/[id]/edit`,
    `/contacts`, `/contacts/[id]`.
- **D39** — Package 2.6 (Leads UI):
  - **`leadCreatableFields` exported from `packages/shared/src/leads.ts`**
    (was a module-private `const`). Needed so `apps/web`'s form-local
    schema override for `estimatedBudget` (the same `z.coerce.number()` /
    `useForm` generic clash as Company's `annualRevenue`, D38) could
    rebuild an object schema from the individual field validators. Unlike
    `createCompanySchema` (a plain `ZodObject`, fixable with `.extend()`),
    `createLeadSchema` is wrapped in `.refine()` for the name+email-or-phone
    rule, and `ZodEffects` has no `.extend()` — re-exporting the
    pre-refine field map was simpler than duplicating ~13 field
    definitions in `apps/web`.
  - **Create and edit use two different form-local schemas, not one
    shared one** (unlike Company/Contact, D38, which validate edits
    against the create schema and PATCH the full field set). Leads'
    `requirement` ("original enquiry") is create-only and read-only after
    that — the roadmap and PRD both treat it as the lead's original
    verbatim enquiry, never edited later — so the edit form has no
    `requirement` field at all, and its schema (`editLeadFormSchema`) omits
    it entirely rather than sending back whatever the create form last
    held. Both schemas `.refine()` the same `emailOrPhoneRefine` check
    against `leadBaseFormFields` (`leadCreatableFields` plus the
    `estimatedBudget` override above).
  - **Duplicate warning reuses the real `GET /leads/duplicates` endpoint**
    (D35) — a genuine contrast with Company's blur hint (D38), which has
    no dedicated endpoint and approximates with `GET /companies?q=`.
    Leads already had a purpose-built, normalised exact-match endpoint
    from the 2.3 API package, so the UI calls it directly on
    email/phone/company-name blur; the warning banner lists each match
    with its reason (email/phone/company name) and a link to the existing
    lead, and never blocks the save — consistent with D29.
  - **Status-change buttons on the lead detail page** render
    `OPEN_LEAD_STATUSES.filter((status) => status !== lead.status)` and
    the whole "Change status" section is omitted once
    `lead.status === "CONVERTED"` — Converted is a Day 3 (lead-conversion)
    feature with no button offered here at all (D29), not merely
    disabled. Every change writes a `LeadStatusHistory` row server-side
    (pre-existing, 2.3) and the detail page's History tab lists them
    newest-first, satisfying the session's "qualifying a lead writes a
    visible history entry" acceptance item.
  - **Original-enquiry panel** renders `lead.requirement` and
    `lead.capturedFields` (an `Object.entries` loop over whatever JSON the
    lead was captured with) as plain read-only text — no PRD field list
    exists for `capturedFields`' shape, so it is displayed generically
    rather than mapped to named labels.
  - **`lib/datetime-local.ts`** (`toDatetimeLocalValue`/
    `fromDatetimeLocalValue`): the lead form's "Next follow-up" field is a
    native `<input type="datetime-local">`, which reads/writes a bare
    local string (`"2026-11-20T14:30"`) with no timezone, while the API
    stores/returns full ISO instants. Small pair of converters isolates
    that mismatch at the form boundary rather than scattering
    `Date`-parsing through the component.
  - **Zod `.refine()` second-argument typing fix**: `{ message, path:
    ["email"] } as const` produced a `readonly ["email"]`, which Zod's
    refine-options type rejects (it wants a mutable `PropertyKey[]`).
    Fixed by dropping `as const` and casting the whole options object to
    `{ message: string; path: string[] }` instead.
  - Sidebar gained a **Leads** entry (`components/app-shell.tsx`), placed
    first — above Companies and Contacts — since leads are the top of the
    funnel; `Target` icon, `"/leads": "Leads"` added to `PAGE_TITLES`.
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
    (249 tests, unchanged — same reasoning as D38: this package was UI
    wiring over the already-tested 2.3 Leads API, with manual coverage in
    `MANUAL-TEST-DAY2.md` instead of new automated tests). New routes
    confirmed in the build output: `/leads`, `/leads/new`, `/leads/[id]`,
    `/leads/[id]/edit`.

**D40–D44 were approved on 2026-11-20, after the user's own manual browser
pass through `docs/MANUAL-TEST-DAY2.md` (all five named acceptance items
passed — see `docs/DAY-2-SUMMARY.md`), as package 2.7's scope. They are
recorded here as decisions, but nothing against them is built yet — do not
treat their presence in this file as evidence the behaviour exists.**

- **D40** — Required fields, HubSpot-style minimal (approved, not yet
  built): Company needs only a name. Contact needs a first name plus an
  email or a phone. Lead needs a first name plus an email or a phone, plus
  a source (which should be preselected to a "Manual" source rather than
  forcing an explicit choice — implies a seeded/default lead source named
  "Manual" needs to exist, or the UI needs to treat the first/only source
  as that default; confirm which when building 2.7). Lead priority
  defaults to Medium. Every other field on all three forms becomes
  genuinely optional. Forms mark required fields with `*` and drop the
  `(optional)` suffix entirely (current forms suffix every optional field
  instead — flip the convention). The Company form additionally gets a
  "More details" collapsed section so the core fields (name, plus whatever
  else is judged core) are the only ones shown by default.
- **D41** — Phone rules (approved, not yet built): a country-code select
  (default `+91`) paired with a plain number field, not one free-text
  field. `+91` requires exactly 10 digits starting with 6–9; any other
  country code requires 7–15 digits. Stored as canonical E.164 in the
  existing `phone` column and the existing normalised column (no schema
  change — `normalize.ts`'s `normalizePhone` is the place this logic
  belongs, reused by Company/Contact/Lead alike). Duplicate detection must
  match across formats (i.e. match on the normalised E.164 form, not the
  raw display string — already true architecturally today, just needs the
  new parsing to feed into it correctly). Displayed back to the user
  formatted, not as a raw E.164 string. This strict validation is for
  **manual CRM data entry only** — the not-yet-built website-intake path
  (Day 3+/later) must use a lenient parse and must never reject an
  enquiry over a phone format; do not share one validator between the two
  paths without a mode flag.
- **D42** — New-record forms must always open empty (approved, not yet
  built; root cause not yet confirmed). The user's browser testing on
  2026-11-20 found old field values persisting into a freshly-opened
  create form. The likely cause is Next.js 16's Cache Components feature
  retaining client component state across a client-side navigation to a
  route that looks unchanged (e.g. `/leads/new` visited twice in a row, or
  reached after visiting `/leads/[id]/edit`) — but this is a probable
  diagnosis, not yet verified against the actual code; confirm before
  fixing (likely candidates: a stale `key` on the form's route segment, or
  a `defaultValues` that isn't being reset on mount).
- **D43** — Contacts require an email or a phone (approved, not yet
  built): the same rule Leads already enforce (D29) is added to Contacts,
  which currently accept neither. `createContactSchema`/the contact form's
  `.refine()` need the same shape as the lead form's
  `emailOrPhoneRefine` (2.6, D39).
- **D44** — Two small Leads UI fixes (approved, not yet built): (1) each
  row on a lead's History tab should show who made that status change
  (the actor), not just the from/to statuses and a timestamp — needs
  checking whether `LeadStatusHistory` already records a `changedByUserId`
  or equivalent (it should, given every other audited table in this
  schema records an actor) and surfacing it in
  `useLeadStatusHistory`/the History tab's render; (2) the lead form's
  "provide an email or a phone number" hint should only be visible while
  that rule is actually unmet, not pinned under the Email field
  permanently regardless of whether one has since been filled in.

**D45 — Package 2.7, built 2026-11-20 (items 1–4; item 5 is this
documentation pass).** Closes out D40–D44.

- **Item 1 (D42) — root cause confirmed, not assumed.** `next.config.ts`
  has `cacheComponents: true`, and `/leads/new`/`/companies/new` build as
  fully static routes (confirmed in `pnpm build`'s own route list, `---`). Next's
  own bundled docs (`node_modules/next/dist/docs/01-app/02-guides/
  migrating-to-cache-components.md` → "UI state preservation", and
  `preserving-ui-state.md` → "Forms, inputs, and state") say directly: with
  Cache Components, Next.js hides a navigated-away-from page using React's
  `Activity` ("hidden" mode) instead of unmounting it, so `useState`/
  react-hook-form state survives a revisit — but effect cleanup still fires
  on hide, exactly like a real unmount. Fixed with exactly the pattern those
  docs recommend: a `useLayoutEffect` whose **cleanup** (not its setup)
  unconditionally resets the form to blank defaults, scoped to create mode
  only (`LeadForm`'s `mode === "create"`, `CompanyForm`'s `!company`).
  `ContactFormDialog` (a dialog, not a page) gets the same treatment plus
  force-closing the dialog itself on hide, since Activity can also preserve
  `open: true` with a stale draft, making the dialog reappear already-open
  on a revisit. `leadToFormValues`/`companyToFormValues`/`contactToFormValues`
  were exported (previously module-private) so tests can assert the reset
  target is genuinely blank. True Activity hide/show (same instance, no
  real unmount) cannot be simulated in this environment — this React build
  does not export `Activity` publicly yet, and there is no browser-
  automation tool here — so the new tests use `unmount()` as the nearest
  available proxy for the identical cleanup callback Activity invokes, not
  a full reproduction; flagged as such rather than overclaimed.
- **Item 2 (D41) — phone architecture.** `packages/shared/src/phone.ts`:
  a fixed, closed `COUNTRY_CALLING_CODES` list (default `+91`; a dozen
  common codes — a judgment call, not a complete E.164 list, same spirit
  as D10's seeded pipeline stages); `isValidPhoneNumber` (`+91` = exactly
  10 digits starting 6–9, every other code = 7–15 digits, no further
  shape rule); `phoneFieldSchema` (strict, for the three manual-entry
  create/update schemas — `""` still valid, it's how every optional field
  here already represents "not provided"); `parsePhoneLenient` (reserved,
  unused — for the not-yet-built website intake path, deliberately a
  *separate* function from the strict validator, not a shared one gated by
  a mode flag, so the intake path can never accidentally inherit the
  strict rule). The wire contract is unchanged: `phone` is still a single
  string field end to end — the frontend's new `PhoneInput`
  (`components/ui/phone-input.tsx`) composes a country-code `Select` and a
  plain number `Input` into one canonical E.164 string before it ever
  reaches a schema; `normalizePhone` (lenient, pre-existing, D33) needed no
  change, since a clean E.164 string already normalises correctly. A real
  bug was found and fixed while testing `PhoneInput`: its first draft
  updated its own "last seen value" tracker inside `emit` (the same moment
  it called `onChange`), which made a same-render echo of its own just-
  emitted value indistinguishable from a genuine external prop change —
  stomping the just-typed digit back to blank on every keystroke whenever
  the parent doesn't echo the prop back synchronously (true of this
  project's own react-hook-form usage, not just the unit test that caught
  it). Fixed by only ever updating that tracker from the external `value`
  prop, never from `emit` — matching `CompanySelect`'s actual working
  mechanism (D37) exactly, not just its surface shape. Two pre-existing API
  tests (`tests/leads/crud.test.ts`) that posted a bare, non-E.164 phone
  string directly were updated to send valid E.164, since that's what a
  real client — the frontend — now always sends.
- **Item 3 (D40 + D43).** Company already required only `name` (no schema
  change); the real work was labelling (`*` on every required field,
  "(optional)" dropped everywhere — optional is now the unmarked default)
  and a new `Collapsible` (`components/ui/collapsible.tsx` — not yet in
  `docs/design-system/`, built from its tokens/motion rules per the
  README's own "build it from these tokens, then send it back" closing
  note) holding Company's non-core fields under "More details": collapsed
  on create, and on edit only opens automatically when the company already
  has a value in one of those fields (a judgment call on exactly which
  fields count as "core" vs. "more details" — name/industry/website/email/
  phone/owner stayed visible; legal name/employee size/annual revenue/
  address/description moved under the fold). Lead's Source field now
  preselects the lead source named **"Manual"** (confirmed against
  `apps/api/prisma/seed-lib.ts` — the seed always creates one by that exact
  name, settling the question `NEXT-SESSION-START.md` flagged, without
  needing to ask) via a `useEffect` matched by name, not list position (the
  seed's first/default-sorted source is actually "Website"); guarded so it
  only applies in create mode and only while nothing has been chosen yet,
  so it never overrides an explicit pick and correctly re-applies after a
  D42 reset-to-blank. For D43, `packages/shared/src/contacts.ts` was
  restructured the same way `leads.ts` already was for D39 — an exported
  `contactCreatableFields` map plus a refined `createContactSchema`
  (`ZodEffects` has no `.partial()`, so `updateContactSchema` is built from
  the same field map directly; deliberately **not** given Lead's extra "at
  least one field" requirement, since that was never a rule here and D43
  doesn't ask for one). `contacts.service.ts`'s `updateContact` gained the
  same post-patch email-or-phone guard `leads.service.ts` already has
  (D35) — Contact has no database CHECK for this, so it's a clean
  application-level 422, not a mapped Prisma error. Found, while adding
  this, that **seven** pre-existing test call sites created a contact via
  the API with neither email nor phone (six in `tests/contacts/crud.test.ts`,
  one in `tests/contacts/isolation.test.ts` — a raw `supertest` POST the
  first grep pass missed because it didn't go through the `authed()`
  helper) — each given a plausible email so the test keeps exercising what
  it actually tests, not tripping the new rule incidentally.
- **Item 4 (D44).** `leadStatusHistoryResponseSchema` gained
  `changedByName`, populated by joining `changedBy: { select: { name:
  true } }` in `listLeadStatusHistory` — `LeadStatusHistory.changedById`
  was already `NOT NULL` with a real FK (confirmed before touching
  anything, not assumed), and users are never hard-deleted (only
  deactivated, D25), so no nullable was needed. The lead detail page's
  History tab now reads "by `<name>` · `<date>`, `<time>`". The lead form's
  permanently-visible hint became conditional on `form.watch("email")`/
  `form.watch("phone")` both being blank — the same pattern Contact's
  brand-new equivalent hint was built with correctly from the start in
  item 3 (first-time-right vs. retrofit are different situations, even
  though both end up with the same conditional-hint code shape).
- **Testing summary across the whole package**: 244 `apps/api` tests (25
  new: phone validation and E.164-rejection across all three resources,
  Contact's email-or-phone create/update cases, the status-history actor
  assertion) + 53 `apps/web` tests (23 new: the D42 reset-target and
  cleanup-doesn't-throw tests per form/dialog, `PhoneInput`'s own
  composition behaviour, the "More details" open/closed-by-default cases,
  the Source-preselect cases, the hint-visibility case) = 297 total, all
  passing, verified after every one of the four commits, not just at the
  end.

**Catch-up note (added 2026-11-20, before package 3.3 started):** D46 and D47
below record packages 3.1 and 3.2, which were already built and committed
(`3f08a38`, `f2c59e0`) before this file was updated for them — a genuine gap
between the commits and this log, not a sign either package is unbuilt. Both
entries were written from the actual shipped code (`lead-conversion.service.ts`,
`deals.service.ts`, `pipeline.service.ts` and their routes/schemas/tests), not
reconstructed from memory, and cross-checked against each commit's own message.

- **D46** — Package 3.1 (lead conversion transaction), built and committed
  2026-11-20 (`3f08a38`), the hardest item on the roadmap and built first, per
  the brief. `lead-conversion.service.ts`'s `convertLead` is one
  `$transaction` following the brief's five steps:
  1. `SELECT ... FOR UPDATE` locks the lead row first (`tx.$queryRaw`, the
     same raw-SQL row-lock pattern as the last-Admin rule, D25), so two
     concurrent conversion attempts on the same lead serialise rather than
     race. Refuses with 409 if the lead is already `archivedAt`, already
     `CONVERTED`, or not currently `QUALIFIED`.
  2. **Company** — links `input.companyId` if given (404 if it doesn't exist
     in this organisation), or creates one from the lead's own
     `companyName`/`website`/`industry`. **Judgment call**: if creating and
     the lead has no `companyName` at all, the API refuses with 422
     (`VALIDATION_FAILED`, path `companyId`, "This lead has no company name —
     link an existing company instead") rather than inventing a placeholder
     name — nothing in the brief says what a nameless auto-created company
     should be called, and forcing the caller to pick an existing company
     felt safer than guessing one.
  3. **Contact** — links `input.contactId` if given and fills **only** the
     fields that were empty (`lastName`, `email`+`emailNormalized`,
     `phone`+`phoneNormalized`, `jobTitle`); an existing contact's
     `companyId` is never touched, even when it's empty and a *different*
     company was just linked on this same conversion (proven by a dedicated
     test, `conversion.test.ts`'s "both existing" case, not just asserted in
     a comment). Otherwise creates a new contact under the resolved company.
  4. **Deal** (only when `input.createDeal` is true) — resolves the
     organisation's default pipeline and its first `OPEN`-type stage
     (`getDefaultPipeline`/`getFirstOpenStage`, built here and reused by 3.2),
     copies that stage's probability onto the deal, creates the deal, a
     `DealContact` row (`isPrimary: true`), and the first
     `DealStageHistory` row (`fromStageId: null`). `deal.ownerId`, if given,
     is checked against the organisation before use — the same cross-org FK
     gap D34 already closed for Company/Contact/Lead's owner fields, closed
     here too rather than left open for Deal's first appearance.
  5. Sets the lead to `CONVERTED` with `convertedAt`, writes one
     `LeadStatusHistory` row and one `LeadConversion` row, repoints any of
     the lead's existing activities onto the new contact/company/deal (none
     can exist yet — Activities is a Day 4 module — but the code is written
     to be correct once they do, per the brief), and writes the
     `lead.converted` audit event — all inside the same transaction.
  - `GET /api/v1/leads/:id/conversion-matches` (`leads:read`) is a plain,
    non-blocking read: existing companies by normalised name, existing
    contacts by normalised email or phone, organisation-scoped, archived
    rows excluded — offered as "link to this instead" suggestions in the
    conversion dialog, never a gate.
  - `POST /api/v1/leads/:id/convert` (`leads:write`) is the only route that
    actually performs a conversion; both routes go through `defineRoute`
    like every other route, so the registry audit covers them automatically.
  - `tests/helpers/tenant.ts`'s `createTestTenant()` was extended to also
    create a real `Pipeline` with the same six stages the production seed
    uses (Qualification 10% … Lost 0%, matching D10's seeded set) — every
    Day 3 test needs a pipeline to convert into, and it should look like real
    seeded data, not an arbitrary one-off fixture. Purely additive (new
    fields on the returned tenant object); no existing test needed to change.
  - **Tests** (`apps/api/tests/leads/conversion.test.ts`, 12 new, all
    green): new company + new contact + a deal, with every created row
    checked directly against the database, not just the response shape;
    existing company + new contact, no deal; both existing (the fill-empty-
    only / company-never-overwritten case); non-`QUALIFIED` lead rejected
    (409); already-`CONVERTED` lead rejected (409); archived lead rejected
    (409); **`"a forced mid-transaction failure leaves nothing behind, and
    the original lead and its history are intact"`** — a cross-organisation
    `contactId` fails step 3 right after step 2's company already ran,
    proving the whole transaction rolls back (no orphan company, no
    `LeadConversion` row, the lead still `QUALIFIED` with exactly its
    original one-row status history); **`"two concurrent conversion requests
    on the same lead produce exactly one conversion"`** — `Promise.all` of
    two simultaneous converts resolves to exactly one 200 and one 409, and
    exactly one `LeadConversion` row exists afterward; Staff can convert
    (D29's equal standing); a lead in another organisation 404s; a
    cross-organisation `companyId`/`contactId` is rejected (404), never
    silently linked; the matches endpoint's name/email/phone matching and
    archived-exclusion.
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
    (256 `apps/api` tests: 244 carried over + 12 new; `apps/web` unchanged at
    53; 309 total).
- **D47** — Package 3.2 (Deals API, stage moves, close/reopen, pipeline
  summary), built and committed 2026-11-20 (`f2c59e0`), on top of 3.1's
  pipeline helpers.
  - **`dealCreatableFields`** (`packages/shared/src/deals.ts`) deliberately
    excludes `stageId` from the shared field map used by both create and
    update — `stageId` is a create-only convenience (pick a starting stage
    other than the pipeline's default first-open one); every stage change
    *after* creation goes only through the dedicated `POST /deals/:id/stage`
    action, never a plain `PATCH`, the same "this field is create-only, not
    reachable from update" pattern Lead's `requirement` already uses (D35).
  - **`getDefaultPipeline`/`getFirstOpenStage` factored into
    `apps/api/src/lib/pipeline.ts`**, out of 3.1's
    `lead-conversion.service.ts` and reused unchanged by
    `deals.service.ts` — "reuse shared helpers instead of duplicating them"
    (CLAUDE.md), not two copies of the same pipeline-lookup logic. One
    pipeline per organisation in the MVP, per the roadmap ("support one
    configurable pipeline initially"); `getDefaultPipeline` prefers the row
    marked `isDefault` and falls back to any pipeline for the org if that
    flag is ever missing.
  - **Create**: `companyId` is required and checked in-organisation
    (404 if not); `ownerId` defaults to the calling user if omitted;
    `stageId` defaults to the pipeline's first `OPEN` stage, or a
    caller-chosen stage (422 if that stage isn't `OPEN` — a deal can't be
    created directly into Won/Lost); `probability` defaults from the
    resolved stage but is freely editable at creation. Writes the deal's
    first `DealStageHistory` row (`fromStageId: null`) in the same
    transaction as the create, exactly like a lead-conversion-created deal
    does (3.1).
  - **Stage move** (`POST /deals/:id/stage`): refuses a non-`OPEN` target
    stage with 422 ("use close to mark it Won or Lost") and refuses
    outright on a deal that isn't currently `OPEN` with 409 ("a closed deal
    is read-only — reopen it first," `assertDealIsOpen`). **Copies the new
    stage's probability onto the deal on every move**, per the roadmap's own
    D7 decision ("probability is copied from the stage on every stage
    change and can be edited per deal") — this overwrites a probability the
    user had manually edited on the deal; that's the roadmap's documented
    behaviour, not a bug to guard against.
  - **Close** (`POST /deals/:id/close`): `WON` or `LOST`; `LOST` requires a
    `lostReason` from the shared `LOSS_REASONS` enum (`lossReasonSchema`,
    D15) — validated by the schema's own `.refine()`, a 422 before the
    service even runs. Moves the deal into whichever `PipelineStage` has
    `type` matching the close outcome (lowest `position`, in case more than
    one existed — none do today, but the query doesn't assume uniqueness),
    sets `probability` to 100 (Won) or 0 (Lost), sets `closedAt`, and writes
    the stage-history row and a `deal.won`/`deal.lost` audit event, all in
    one transaction. If an organisation somehow has no matching WON/LOST
    stage configured, this is a 500 (`INTERNAL`) — a seed-data integrity
    problem, not something a caller's input could trigger under normal use.
  - **Reopen** (`POST /deals/:id/reopen`, judgment call): only valid on a
    deal that isn't currently `OPEN` (409 "this deal is already open"
    otherwise); returns the deal to the pipeline's **first `OPEN` stage**
    (not wherever it was before closing — nothing is recorded about that),
    with that stage's probability, clearing `closedAt`/`lostReason`/
    `lostNote` and writing a fresh stage-history row. The brief says reopen
    must exist but doesn't say which stage it should land on; "back to the
    start of the pipeline" was simpler and more predictable than trying to
    recall or infer wherever the deal was before it closed.
  - **Closed-deal read-only boundary, and its one deliberate exception
    (judgment call)**: `PATCH /deals/:id`, `POST /deals/:id/stage`, and
    `PUT /deals/:id/contacts` all refuse with 409 on a non-`OPEN` deal
    ("a closed deal is read-only except for reopen" — `assertDealIsOpen`,
    one shared check used by all three). **Archive and restore are
    deliberately NOT gated by this check** — `archiveDeal`/`restoreDeal`
    only look at `archivedAt`, never at `status`, so a Won or Lost deal can
    still be archived or restored exactly like an open one. The roadmap's
    "a closed deal is read-only except for reopen" is read here as "the
    deal's pipeline/commercial fields are frozen," not "nothing can ever
    touch this row again" — archiving is a records-management action (D3,
    "staff may archive and restore business records," already applies
    uniformly to every resource in this app), not a pipeline mutation, so
    excluding it from the closed-deal lock was judged the more consistent
    reading, not an oversight.
  - **`PUT /deals/:id/contacts`** fully replaces the deal's contact set
    (delete-then-recreate inside the transaction, not a diff/patch) and
    marks exactly one contact primary — `primaryContactId` if given and
    present in `contactIds`, otherwise the first id in the list. Every
    `contactId` is checked to exist in the organisation before any write
    (404 if not, all-or-nothing).
  - **`pipeline.service.ts`**: `GET /pipeline/stages` returns the org's
    pipeline stages ordered by `position`. `GET /pipeline/summary` is
    computed **entirely in Postgres** — `COALESCE`/`SUM`/the weighted-value
    multiplication (`value * probability / 100`) all run as SQL over
    `NUMERIC` columns, never recomputed in JavaScript over floats, per the
    brief's own instruction that pipeline totals must reconcile exactly with
    a hand-written SQL check. Returns a per-stage breakdown (count, total
    value, weighted value) across **every** stage including Won/Lost — so a
    Kanban board can show a running total on every column, not just the open
    ones — plus a separate `open` aggregate scoped to `status: 'OPEN'`,
    non-archived deals only.
  - **Found empirically, not assumed**: `Prisma.Decimal` stringifies an
    empty stage's `COALESCE`'d zero as `"0"`, not `"0.00"` — the pipeline
    summary test's own expectations were written to match this directly,
    confirmed by running it, rather than guessed from how Decimal values
    look elsewhere in this app (e.g. `deal.value.toString()` on a real,
    non-zero row does carry the full `14,2` precision).
  - Routes: `GET`/`POST /deals`, `GET`/`PATCH /deals/:id`, `POST
    /deals/:id/{stage,close,reopen,archive,restore}`, `PUT
    /deals/:id/contacts` (all `deals:read`/`deals:write` or
    `records:archive` — the same permission Companies/Contacts/Leads
    archive/restore already use); `GET /pipeline/{stages,summary}`
    (`deals:read`) — all via `defineRoute`, registered in `app.ts`, so the
    route-registry audit covers them automatically like every other route in
    this app.
  - **Tests** (`apps/api`, 19 new, all green): `crud.test.ts` — create
    defaults (stage/probability/owner), a missing `companyId` 422, full
    CRUD plus archive/restore, double-archive 409, the contacts `PUT`
    replacing the set and marking a primary, Staff permissions (D29's equal
    standing extends to Deals), cross-organisation 404 on read and on a
    cross-org `companyId` at create. `stage-and-close.test.ts` — a stage
    move writes history and copies the new stage's probability (overwriting
    a manual edit, confirming the D7 behaviour above is real, not just
    documented); moving to a Won/Lost stage via `/stage` is refused (422);
    closing Lost without a reason is refused (422); closing Won/Lost sets
    probability/`closedAt`/the matching stage with history; a closed deal
    refuses `PATCH`/`/stage`/`/close` again (409) but reopen succeeds and
    restores write access; reopening an already-open deal is refused (409).
    `pipeline.test.ts` — `GET /pipeline/stages` returns all six seeded
    stages in order; `GET /pipeline/summary` is cross-checked against a
    hand-written SQL query built *independently* in the test (a differently-
    shaped query, not a call into the service's own function) across open,
    closed, and archived deals spread across different stages.
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
    (275 `apps/api` tests: 256 carried over + 19 new; `apps/web` unchanged at
    53; 328 total).
- **On the five judgment calls named when D46/D47 were approved**: two of
  the five ("a closed, fixed country-code list for phone entry" and "Company
  splits core fields from a collapsed 'More details' section") are **not**
  new to 3.1/3.2 — they're package 2.7's D41 and D40/D45 respectively,
  already fully recorded there. They're noted here only because they were
  named again in the same approval message as the three genuinely new 3.1/
  3.2 calls (company-name-required-to-create, D46; reopen-to-first-open-
  stage and archive/restore-allowed-on-closed-deals, both D47) — not because
  anything about them changed or needed re-deciding.
- **D48** — Package 3.3 (Deals list, forms, detail, close dialogs), built
  2026-11-20. Three backend additions found necessary while building the
  UI, each flagged against the 3.3 brief's pre-approved allowance before
  being built (the fourth — a lead conversion summary on `GET /leads/:id`
  — was deliberately deferred to 3.5, where it's actually consumed, not
  built speculatively now):
  - **`contactId` filter on `GET /deals`** (`packages/shared/src/deals.ts`'s
    `listDealsQuerySchema`): filters via the `DealContact` join table
    (`dealContacts: { some: { contactId } }`) — a deal has no direct
    `contactId` column, unlike `companyId`. Not used by 3.3 itself; added
    now because 3.5's Contact "Deals" tab will need it and the one-line
    schema/service change was trivial alongside the rest of this package.
  - **`GET /deals/:id/stage-history`** (`dealStageHistoryResponseSchema`,
    `listDealStageHistory` in `deals.service.ts`): the Stage history tab's
    data source, same shape and reasoning as Lead's status-history (D35) —
    newest first, with the actor's name joined at query time
    (`changedBy.name`), ids for `fromStageId`/`toStageId` rather than
    names (the frontend already holds the pipeline's stage list from `GET
    /pipeline/stages` and maps ids to names itself, so the history
    endpoint doesn't need to duplicate that join).
  - **A real gap found while building the Contacts tab, stopped and asked
    per instruction** (not covered by the three pre-approved additions):
    the brief asks the Contacts tab to *list* a deal's contacts, but the
    only existing route, `PUT /deals/:id/contacts`, only ever returns the
    state *after* a write — there was no way to read a deal's current
    contacts on first page load. Asked; approved option: extend
    `dealResponseSchema` itself with a read-only `contacts:
    { contactId, contactName, isPrimary }[]` summary (mirrors the
    lead-conversion-summary allowance's own shape), populated by a `Prisma
    include` (`dealContactsInclude`, joining `DealContact.contact.{firstName,
    lastName}`) added to every query that builds a `DealResponse` — create,
    get, update, move-stage, close, reopen, archive, restore, and the list
    endpoint all return the same, always-accurate `contacts` array; a
    freshly created deal correctly returns `contacts: []`, not an absent
    field. `apps/web`'s `DealContactsTab` reads this field directly off the
    `deal` object it already has — no second round trip, no `useQueries`
    fan-out over individual contact ids (the alternative considered and
    rejected when the gap was first found).
  - **`DealForm`** (`apps/web/components/deals/deal-form.tsx`): one shared
    create/edit form, same "validate against the create schema even when
    editing" convention as Company/Contact (D38) — `updateDealSchema` has
    no `stageId` key at all (D47: stage changes only ever go through `POST
    /deals/:id/stage`), so the Stage `Select` is rendered **only in create
    mode**; submitting it anyway in edit mode would be harmless (an unknown
    key is silently stripped, same as Lead's read-only fields, D35), but
    hiding it is more honest about what editing can actually change.
    `value`/`probability` needed the same `z.coerce.number()` →
    non-coercing-override fix as Company's `annualRevenue` (D38) and Lead's
    `estimatedBudget` (D39) — the third time this exact Zod v4 gotcha has
    been hit, not a new discovery. Create mode defaults Stage to the
    pipeline's first `OPEN` stage once stages load and copies its
    probability onto the Probability field (same "preselect a sensible
    default, never override an explicit pick" pattern as Lead's Source,
    D40/D45) — changing Stage before submit re-copies the new stage's
    probability the same way `moveDealStage` does probability as an
    auto-filled *suggestion* once, which the user may then freely edit,
    matching exactly what the API itself does on a real stage move (D47).
  - **`ContactSelect`** (`apps/web/components/pickers/contact-select.tsx`):
    a new async combobox picker, the same hand-built pattern as
    `CompanySelect` (D37) — no second Combobox/Command primitive added for
    one picker. Takes an optional `companyId` to narrow the search (used
    by the Contacts tab, scoped to the deal's own company) but does not
    require the match to belong to that company — a deal's contacts are
    not schema-restricted to its own company's contacts either, so the
    picker doesn't invent a restriction the API doesn't enforce.
  - **`DealContactsTab`**: add/remove/make-primary all go through one
    `replaceContacts(contactIds, primaryContactId)` helper that always
    calls the one real mutation, `PUT /deals/:id/contacts` (full replace,
    D47) — there is no partial add/remove endpoint, so the tab computes
    the next full list client-side (current contacts plus or minus one,
    or the same list with a different `primaryContactId`) before every
    call. Hidden entirely behind the same `status !== 'OPEN'` closed-deal
    check the rest of the detail page actions use (D47) — contact changes
    on a closed deal are blocked in the UI exactly as they already are at
    the API.
  - **`apiPut`** added to `apps/web/lib/api-client.ts` — the first `PUT`
    route this app's frontend has needed; same shape as the existing
    `apiPost`/`apiPatch`.
  - **Detail page actions, closed-deal gating**: Edit, Move stage (a
    `DropdownMenu` listing the pipeline's other `OPEN` stages — not a
    persistent `Select`, since this is a one-shot action, not a stored
    selection), Close as Won (`ConfirmActionDialog`, a plain confirm), and
    Close as Lost (`CloseLostDialog`, new — a reason from `LOSS_REASONS` is
    required before its submit button enables) are all hidden once
    `deal.status !== 'OPEN'`; Reopen appears only then. **Archive/Restore
    are shown regardless of status** — the UI mirrors D47's own backend
    choice exactly, not an independent frontend decision.
  - **Weighted value is computed client-side**
    (`Number(deal.value) * deal.probability / 100`) for the key-facts strip
    display only — the authoritative weighted-value arithmetic for the
    *pipeline* (summed across many deals) still happens entirely in
    Postgres (`pipeline.service.ts`, D47); this is a single-deal display
    convenience, not a second source of truth for anything aggregated.
  - **Testing**: component tests avoid simulating a Radix `Select`
    dropdown's open/pick interaction — consistent with every existing test
    in this repo (`lead-form.test.tsx`'s Source-preselect test only ever
    asserts the trigger's *displayed* text, never opens it) — so "stage
    change pre-fills probability" is tested via the create-mode *default*
    autofill (the same code path `onValueChange` would also run), not a
    simulated manual pick; "Lost dialog cannot submit without a reason" is
    tested by opening the dialog (Radix `Dialog`, not `Select` — no
    established avoidance pattern for that one) and asserting the footer
    button's `disabled` property directly (no `@testing-library/jest-dom`
    in this repo, D37, so no `toBeDisabled()` matcher). 10 new `apps/web`
    tests (`deal-form.test.tsx`, `close-lost-dialog.test.tsx`,
    `deal-detail-page-client.test.tsx`); 4 new `apps/api` tests (the
    `contacts` summary round-trip, the `contactId` filter, and the
    stage-history endpoint's ordering/actor/cross-org cases — the latter
    across its own 3-test file). `pnpm typecheck && pnpm lint && pnpm test
    && pnpm build` all pass clean (279 `apps/api` + 63 `apps/web` = 342
    tests).
- **D49** — Package 3.4 (pipeline board, `@dnd-kit/core`), built
  2026-11-20. New dependency, approved in advance: `@dnd-kit/core@6.3.1`
  (current npm "latest" at the time) in `apps/web` only — confirmed before
  installing (and again on a clean `pnpm install` afterward) that it adds
  no peer-dependency warning against this repo's `react@19.3.1`
  (`@dnd-kit/core`'s own peer range is `react: '>=16.8.0'`). Its own
  internal dependencies (`@dnd-kit/accessibility`, `@dnd-kit/utilities`,
  `tslib`) came along as transitive installs of `@dnd-kit/core` itself, not
  separately chosen — `@dnd-kit/sortable` was deliberately **not** added
  (the approval was `@dnd-kit/core` only); its default keyboard
  coordinate-getter, built into `@dnd-kit/core` itself, is what the
  `KeyboardSensor` uses here, not `/sortable`'s sortable-list-aware one —
  correct for a Kanban board, where collision detection (not list-order
  logic) decides the drop target anyway.
  - **Board/List toggle**: `/deals?view=board` vs. the default
    (`list`/unset) — kept in the URL via the same `useListUrlState`
    mechanism every other filter already uses, so a shared or bookmarked
    link reproduces the chosen view. Switching to Board hides the 3.3 list
    and its filter bar entirely rather than showing both at once.
  - **Columns = the pipeline's `OPEN`-type stages only, in position
    order**, per the brief — Won/Lost never get a column; their
    organisation-wide totals (not per-deal cards) surface in a small
    "Open pipeline" summary bar above the board instead, sourced from
    `GET /pipeline/summary`'s own `open` aggregate (the same endpoint 3.2
    already computes entirely in Postgres SQL, D47 — no new client-side
    aggregation invented here).
  - **Every column runs its own fixed-shape query**
    (`{ stageId, archived: false, pageSize: MAX_PAGE_SIZE, sort:
    "createdAt:asc" }`, no search/sort choice exposed) deliberately kept
    simple and literal so its TanStack Query cache key is predictable and
    referenceable by exact shape from the move-mutation's optimistic
    update — not reusing 3.3's list-page query params (which vary with
    user-chosen filters/sort and would make the cache key a moving
    target). If a column's `meta.total` exceeds what fit in one page (the
    list helper's `MAX_PAGE_SIZE`, 100, D33), a "Showing N of M — open List
    view" note links to the 3.3 list prefiltered to that stage — no new
    endpoint added for this, exactly as the brief specified.
  - **One shared move-mutation** (`useMoveDealMutation`), used by both the
    drag handler and every card's own "Move to…" dropdown — the always-
    present fallback the brief calls for, independent of whether drag
    itself works in the viewer's browser or input method. Follows
    TanStack Query's own documented optimistic-update recipe: cancel the
    two affected columns' in-flight queries, snapshot both, patch both
    caches immediately (move the card, adjust each `meta.total`), call
    `POST /deals/:id/stage` for real, roll back both snapshots on error
    (with a toast), and broadly invalidate `deals` and `pipeline` on
    settle either way — so every other view (the 3.3 list, the deal
    detail page, the pipeline summary) reconciles with the server
    regardless of how precise the optimistic patch was, not just the
    board itself.
  - **Drag mechanics**: `PointerSensor` with an 8px `activationConstraint`
    (the standard dnd-kit mitigation so a plain click on the card's own
    name link, or its dropdown trigger, still registers as a click rather
    than being swallowed by drag-start) plus `KeyboardSensor` with its
    built-in default coordinate getter; `closestCenter` for collision
    detection (built into `@dnd-kit/core`, not a separate import). The
    dragged deal's own data travels on the draggable itself
    (`useDraggable({ id, data: { deal } })`), read back via
    `event.active.data.current?.deal` in the drag-end handler — not
    re-derived from id by searching every column's cache.
  - **Verification limits, stated plainly, per the brief's own time-box
    clause**: the dropdown fallback — the one explicitly required test —
    is proven in `apps/web/tests/components/pipeline-board.test.tsx`
    against a small stateful fake backend (the mocked deal genuinely
    changes stage, or genuinely doesn't on a forced failure, so the same
    assertions hold whether checked against the immediate optimistic
    state or the post-invalidation refetched state): a successful move
    calls `POST /deals/:id/stage` and the card ends up in the target
    column; a failed move rolls back to the original column. Opening the
    dropdown itself needed keyboard activation (`Enter` while focused),
    not a plain `fireEvent.click` — Radix's menu trigger opens on
    `pointerdown` in a real browser, which jsdom's `PointerEvent` support
    doesn't reliably simulate; every Radix trigger also supports keyboard
    activation, so this is a faithful alternative, not a workaround that
    tests something different. **The actual pointer/touch drag gesture
    itself was not, and could not be, interactively verified** — this
    environment has no browser-automation tool (true of every UI feature
    built in this project so far, not new to this package) and the
    project's own dev server, already running on ports 3000/4000 under
    the user's own session, was correctly left untouched rather than
    started a second time to poke at manually. The implementation follows
    `@dnd-kit/core`'s standard, documented usage exactly (the same shape
    as its own official examples), typechecks, lints clean, and builds —
    but "clean and reliable" drag, specifically, is for the user to
    confirm in a real browser per the brief's own time-box clause, the
    same way every other interactive behaviour in this project has always
    needed a human to click through it at least once.
- **D50** — Package 3.5 (Convert dialog and related tabs), built
  2026-11-20. Two backend additions, each matching the brief's
  pre-approved allowance (the lead conversion summary was explicitly named
  as allowed back in 3.3's brief; the `companyName` override was
  explicitly called out in 3.5's own brief as "add it if the convert API
  doesn't already accept one" — it didn't):
  - **`companyName` on `convertLeadSchema`** (`packages/shared/src/
    lead-conversion.ts`): only ever read when `companyId` is absent (i.e.
    creating a new company), and overrides the lead's own `companyName` in
    `lead-conversion.service.ts`'s `convertLead` (`(input.companyName ??
    lead.companyName)?.trim()`). This is what lets the Convert dialog's
    "create new company" field stay editable and required even when the
    lead itself has no company name, rather than the lead dead-ending in
    the service's existing 422 ("link an existing company instead," D46) —
    the 422 itself is unchanged and still fires when *neither* the lead
    nor the request body has a name. Three new tests
    (`tests/leads/conversion.test.ts`): the override creates the company
    with the typed name; the 422 still fires with neither source present;
    and `GET /leads/:id` now returns the conversion summary described
    next.
  - **`conversion` on `leadResponseSchema`** (`packages/shared/src/
    leads.ts`): `{ companyId, contactId, dealId } | null`, for the
    Converted panel's links and conversion date. Deliberately **only
    populated by `GET /leads/:id`** (`leads.service.ts`'s `getLead`, one
    extra `leadConversion.findUnique({ where: { leadId } })` — cheap,
    since a non-converted lead simply has no row), never by `GET /leads`'s
    list rows — no list view needs it, and the list endpoint already
    returns many rows per call, so `toLeadResponse` keeps a default
    parameter (`conversion: LeadConversionSummary = null`) rather than
    forcing every call site to pass one. **Found and fixed one real bug
    while wiring this in**: `listLeads`'s `rows.map(toLeadResponse)`
    passed array `map`'s `(value, index, array)` signature straight into
    `toLeadResponse`'s now-two-parameter signature, silently handing the
    row's numeric *index* to the `conversion` parameter — caught by
    `pnpm typecheck` immediately (a real type error, not just a lint
    nit), fixed by wrapping the call in an explicit arrow function
    (`rows.map((lead) => toLeadResponse(lead))`) — the same class of bug
    `useLeadStatusHistory`/other bare-function-reference map calls in this
    codebase have so far avoided only by accident of having a
    single-parameter signature.
  - **`LeadDetailPageClient`'s Convert action**: a real, clickable
    `ConvertLeadDialog` trigger only when `lead.status === 'QUALIFIED'`
    and not archived; a plain disabled `Button` (title "Qualify the lead
    first") for every other open status; hidden entirely once archived or
    `CONVERTED` — matching the service's own real constraints (D46)
    exactly, not an independent frontend guess. A new "Converted" panel at
    the top of the Overview tab (shown once `status === 'CONVERTED'` and
    `lead.conversion` is present) replaces the "Change status" section
    there, with links to the company/contact/deal and the conversion date;
    the History tab is untouched and still shows every status row,
    including the final `-> CONVERTED` one.
  - **`ConvertLeadDialog`** (`apps/web/components/leads/
    convert-lead-dialog.tsx`): three sections (Company, Contact, Deal),
    each a `ModeToggle` (Link existing / Create new) — not a Radix
    `RadioGroup` (not installed; a two-button toggle, same pattern as the
    3.4 Board/List toggle, needed no new primitive). Defaults are derived
    from `GET /leads/:id/conversion-matches` once per dialog-open session:
    a real match pre-selects "Link existing"; no match defaults to
    "Create new" with the company name prefilled from the lead (editable,
    and empty when the lead has none — this is exactly the gap
    `companyName` above closes). The deal section's Stage is shown as
    plain text (the pipeline's first open stage, from `GET
    /pipeline/stages`) — never editable, matching `convertLeadSchema`'s
    `deal` object, which has no `stageId` field at all.
  - **A genuine race condition found and fixed by this package's own
    tests, not a hypothetical**: the first draft initialised all of the
    dialog's defaults in a `useEffect` keyed on `matchesQuery.data`
    arriving. Because the matches lookup is a real network round trip,
    the effect could — and in the "create-new company requires a name"
    test, reliably did — fire *after* the user had already started typing,
    silently overwriting their input back to blank the instant the
    (by-then-stale) "no match found" default applied. Fixed by keeping the
    three sections entirely unrendered while `matchesQuery.isLoading` is
    true (a "Looking for existing matches…" message shows instead), so
    the user has no field to type into before the one-time initialisation
    has already run and committed. The initialisation itself was also
    moved out of a `useEffect` entirely, onto React's own "adjust state
    during render" pattern (`CompanySelect`/`ContactSelect`'s existing
    convention, D37) — not to fix the race (the loading-gate above does
    that), but because the effect's several direct `setState` calls
    tripped this repo's `react-hooks/set-state-in-effect` lint rule; `
    LeadForm`'s/`DealForm`'s equivalent default-prefill logic avoids this
    rule only because it calls react-hook-form's `setValue` instead of a
    plain `useState` setter, which the rule doesn't track.
  - **No double-submit**: `handleSubmit` checks `if (pending) return;`
    before anything else, and the submit button is also `disabled`
    once `pending` is true — belt-and-suspenders, proven by a test that
    fires two synchronous clicks and asserts exactly one `POST` reached
    the server.
  - **On a 409** (the lead was converted, archived, or moved off
    `QUALIFIED` by someone else since the dialog opened, D46): the banner
    shows the server's own message verbatim, and the lead's detail-view
    query (`[LEADS_QUERY_KEY_ROOT, "detail", lead.id]`) is invalidated so
    the page behind the dialog reflects the lead's real current state —
    the dialog itself is left open rather than auto-closed, since closing
    it would discard the error message before the user could read it.
  - **`DealsTab`** (`apps/web/components/deals/deals-tab.tsx`): shared by
    Company's and Contact's detail pages, reusing `GET /deals`'s
    `companyId`/`contactId` filters (`contactId` was 3.3's own forward-
    looking addition for exactly this, D48) — a bounded, unpaginated list
    (`pageSize: 50`), same spirit as `CompanyContactsTab` (2.5, D38), not
    the full `DataTable` (a handful of deals per record doesn't need its
    own search/sort/paging; the real `/deals` list already covers that
    case). Only Company's tab gets an "Add deal" link
    (`/deals/new?companyId=...`), per the brief — Contact's is read-only.
  - **`DealForm` gained `defaultCompanyId`** (create mode only): prefills
    Company from the `?companyId=` query param `CreateDealPageClient`
    reads via `useSearchParams()` — still editable, just a sensible
    starting point, the same "default, never force" spirit as every other
    prefill in this app. Needed a real `<Suspense>` boundary added to
    `/deals/new/page.tsx` (D26's requirement for any `useSearchParams()`
    caller), which the page didn't need before this package.
  - **Testing**: 3 new `apps/api` tests (the `companyName` override, the
    still-422-without-either-name case, and the `GET /leads/:id`
    conversion-summary round-trip, folded into
    `tests/leads/conversion.test.ts`); 9 new `apps/web` tests across two
    new files (`convert-lead-dialog.test.tsx` — the race-condition fix
    itself, create-new-company-requires-a-name, deal-fields-hidden-when-
    unchecked, double-click-sends-one-request; `lead-detail-page-client.
    test.tsx` — Convert enabled only when `QUALIFIED`, disabled for every
    other open status, hidden once `CONVERTED` or archived, and the
    Converted panel's three links). `pnpm typecheck && pnpm lint && pnpm
    test && pnpm build` all pass clean (282 `apps/api`: 279 carried over +
    3 new; 74 `apps/web`: 65 carried over + 9 new; 356 total).
- **Environment note, not a code decision**: partway through verifying
  this package, Docker Desktop's own engine API started returning a
  blanket 500 Internal Server Error on every command (`docker ps`,
  `docker exec`), independent of anything in this repo — confirmed by two
  separate overlapping `apps/api` test runs left stacked against the same
  `crm_test` database (an avoidable mistake: a background test run was
  re-launched without first confirming the earlier one had actually
  exited), which combined with an already-restarting Docker Desktop
  process (five separate `Docker Desktop.exe` instances observed at once)
  to wedge the engine badly enough that even a plain restart didn't clear
  it — the user resolved it with a full machine reboot. No code, config,
  or container was touched to work around it; verification simply waited
  until the owner's own Docker Desktop was healthy again, then re-ran
  cleanly. Recorded here only so a future session doesn't mistake "the
  background test runner can be re-invoked without checking if the first
  one finished" as safe — on this machine, with this test suite's ~50
  isolated worker processes per run, it visibly is not.

## D51 - Day 4 package 4.0: optional source and decimal text input (2026-11-21)

- Manual lead Source is optional. If `sourceId` is omitted, the API resolves the exact source name `Manual` within the request organisation; an explicit source remains validated against that organisation. The lead form therefore leaves Source blank and has no required marker. No schema change is needed because `leads.source_id` remains non-nullable and receives the resolved source.
- Numeric editing uses text-backed controls so deletion of leading zeroes works, clearing stays empty, and money values remain decimal strings through request validation. The API constructs Prisma Decimal values from those strings; probability remains an integer. This applies to deal value, estimated budget, annual revenue, and probability. Employee size was already a text field that preserves its entered representation and continues to allow ranges such as `51-200`.
- Reconciliation compares the roadmap's independent SQL against authenticated `GET /pipeline/summary`; count, total value and weighted value matched exactly (formatting may omit trailing zeroes). See `docs/reconciliation.md`.
- No dependency, migration, permission change, UI restyling, or website integration.

## D52 — Day 4 package 4.1: activities, timelines and time bounds (2026-11-21)

- Implemented the Activities API and record timelines on the existing activity schema. No migration or index was created; the verified link indexes and partial `(organization_id, assignee_id, due_at)` index already exist.
- Every activity requires an organisation-owned record link; deal-linked activities also link to the deal's company. Notes are created DONE with `completedAt`; completing/cancelling non-open rows returns 409. Assignee defaults to the current user.
- Staff and Admin both use the existing `activities:read` and `activities:write` permissions; the permission table was unchanged.
- Timelines merge activities with lead status and conversion events and deal stage history, newest first; they include a computed next open task/call/meeting.
- `orgDayBounds` and `orgMonthBounds` are the time-boundary helpers, tested around Asia/Kolkata midnight and month change. No dependencies added.
## D53 — Day 4 package 4.2: Today, dashboard and sample seed (2026-11-21)

- `GET /today` uses `activities:read` with scope `mine` by default; `GET /dashboard` uses `dashboard:read` with scope `all` by default. Admin and Staff retain their existing permissions.
- Dashboard metric definitions are the owner's approved roadmap table: selected-range lead cohort metrics, open-deal pipeline as an unfiltered snapshot, won/lost and revenue by `closedAt`, win rate among closed deals, overdue task/call/meeting count before the organisation's local day start, and six local-month won-revenue buckets. Every metric excludes archived records; scopes use lead/deal owner and activity assignee.
- Money aggregations stay in PostgreSQL NUMERIC. Existing pipeline summary logic accepts an optional owner filter and is reused for the dashboard pipeline breakdown. `orgDayBounds`/`orgMonthBounds` remain the sole boundary helpers.
- Independent test SQL covers every KPI, source/status breakdowns, pipeline stages, monthly revenue and recent activity for all/mine, one-day and empty ranges, empty organisations, and cross-organisation isolation.
- Added `pnpm db:seed:sample`: local fictional sample records are found-or-created, dates are relative to now, three tasks are overdue, repeat execution preserves counts, and the script refuses `NODE_ENV=production`. No new dependency, schema migration or permission change. Day 4 UI is intentionally outside this prompt.
- Follow-up link correction (`a42b506`): recently updated deals link to `/deals` without a status filter so Won and Lost deals remain reachable; NEW-lead links retain the owner filter for `scope=mine`.

## D54 — Day 4 package 4.2b: close backend gaps (2026-11-21)

- Added computed `nextActivity` to `GET /leads/:id` and `GET /deals/:id`: the earliest open task/call/meeting, including overdue items, with `type`, `subject`, `dueAt` and organisation-local `isOverdue`; done, cancelled and notes do not qualify. Each detail request performs one scoped activity lookup; list responses omit the summary.
- Added shared-Zod `dueFrom`, `dueTo` and `overdue=true` activity-list filters. Due bounds are inclusive and validated in order. Overdue means an open task/call/meeting with `dueAt` before `orgDayBounds(now, timezone).start`; `now` is injectable at the service boundary. Existing assignee, status, type and linked-record filters remain; `dueAt` was already sortable.
- Fixed monthly won-revenue bucket anchoring to use the organisation's local year/month at month transitions.
- Expanded tests for fixed-clock overdue membership through the endpoint, lead/deal next activity, contact/company/deal timelines and mixed history ordering, Staff access to Today/dashboard, cross-organisation Today records, empty dashboard auxiliary SQL comparisons, and the dashboard month transition.
- Extended the idempotent sample seed with a due-today task, a meeting today and meetings in the next 7 days, a NEW lead owned by the demo Admin, and an open closing-soon deal with no open activity. It continues to use found-or-create only and refuses production. No schema/migration, dependency or permission change.
- Final root verification: 294 API + 75 web tests (369 total), across 55 API and 16 web test files; typecheck, lint and build passed. Lint retains three existing React Hook Form warnings.

## D55 — Day 4 package 4.3: Activity composer and record timelines (2026-11-21)

- Reuse one `ActivityComposer` and one `RecordTimeline` on Lead, Contact, Company and Deal details. The composer defaults to Task and the current user, links to the current record, uses Task/Call due date-time and Meeting start/end date-time fields, and keeps priority, assignee and description available. Notes have no due-date control; the existing API stores them as DONE. The type picker is an accessible tablist with arrow/Home/End keyboard navigation.
- Each Timeline tab fetches pages of ten from the existing timeline endpoint and offers Load more. Open activities can be completed or cancelled; completing or creating an activity invalidates the timeline and the affected detail query so `nextActivity` refreshes. Lead and Deal key-facts strips show the existing API `nextActivity`, including the dot-and-word Overdue badge.
- **Completion actor and time:** the Activity row stores `completedAt` but not the completing user. The existing `activity.completed` AuditEvent stores the actor. The timeline service now performs one organisation-scoped lookup for the page's activities' completion audit events and includes `status`, `completedAt` and `completedByName` as optional timeline-entry fields. This is a read-only response enrichment; no schema, route, permission or dependency changed. The API test proves the completing user's name and timestamp appear.
- **Design/test choices:** keep the existing Lead History and Deal Stage history tabs as dedicated views while adding the merged Timeline tab; this preserves existing page behavior and keeps the combined chronology distinct. New tests: `apps/api/tests/activities/activities.test.ts` (completed actor/time in timeline) and `apps/web/tests/components/activity-composer.test.tsx` (4 cases: selected type/record link, Note with no due date, completion refresh and actor/time display, overdue label). Root counts are 295 API + 79 web = 374 (55 API and 17 web test files).
- Sequential verification passed: `pnpm typecheck`; `pnpm lint` (three existing React Hook Form warnings); `pnpm --filter api test` (295); `pnpm --filter web test` (79); `pnpm build`. No browser was started, so actual theme rendering, focus order and browser console remain for the manual Day 4 check.

## D56 — Day 4 package 4.4: My Tasks and Today workspace UI, resumed from a half-built handoff (2026-11-23)

- **Starting state, audited before trusting it.** A prior tool's session had left package 4.4 uncommitted and half-built: an `apps/web/app/(protected)/tasks/` page and `components/tasks/tasks-page-client.tsx` (untracked), plus uncommitted edits to `activities.service.ts` (a `priority` list filter), `workspace.service.ts` (Today items' `href` changed from a filtered-list link to a direct per-record link, with new `recordType`/`recordId` fields), `activity-composer.tsx` (a new `onCreated` callback), `app-shell.tsx` (Today/My Tasks nav entries — linking to a `/today` route that did not exist), and the matching `packages/shared` schema changes. `docs/PROJECT-STATE.md` and `docs/decisions.md` were checked and were **not** actually edited for 4.4 despite the handoff prompt's claim — `git status` showed them untouched, so no doc correction was needed on that point.
- **Kept, after verifying against the brief**: the `priority` filter and the Today href/`recordType`/`recordId` change. The latter is exactly what this package's own brief requires ("a link to open each record") — the previous filtered-list hrefs (e.g. `/activities?type=TASK&status=OPEN`) could not satisfy that, since this app has no activity-detail page. The existing `tests/workspace/workspace.test.ts` assertions still expected the old hrefs and would have failed outright; they are corrected here, with `recordType`/`recordId` assertions added, rather than left broken or reverted.
- **Not kept as found**: `tasks-page-client.tsx` was rewritten rather than finished in place. It did not reuse `DataTable`, used raw enum text in `Badge`s instead of the existing `priorityLabel`/`priorityBadgeVariant` helpers, hand-rolled the Open/Overdue/Done switch instead of the shared `Tabs` primitive already used for every other in-app tab, and imported a `formatDateTime` from `lib/format.ts` that does not exist there (only `formatDate`/`formatTime`) — this alone would have failed `pnpm typecheck`. The rewrite reuses `DataTable`, `Tabs`/`TabsList`/`TabsTrigger`, and `priorityLabel`/`priorityBadgeVariant`, and adds a new `apps/web/lib/activity-presentation.ts` (`activityTypeLabel`, `activityStatusLabel`/`activityStatusBadgeVariant`) mirroring the existing `lead-presentation.ts`/`deal-presentation.ts` pattern — no prior file in this repo already provided activity type/status labels, so this is new, not a duplicate.
- **`/today` did not exist at all** — only the sidebar links to it did. Built from the brief: one card per `GET /today` section (Overdue, Tasks due today, Meetings this week, New leads, Deals closing soon, Deals with no next activity, Recently updated deals), a Mine (default)/All scope toggle kept in the URL via the existing `useListUrlState` hook, a Complete action on the two task sections only (per the brief's wording — not on meetings), and an "Add follow-up" quick action on every row that names a record. The new `AddFollowUpDialog` (`components/activities/add-follow-up-dialog.tsx`) is a controlled `Dialog` reusing the existing `ActivityComposer` unchanged apart from its new `onCreated` prop, which it uses to close itself on success — this is what the prior session's otherwise-orphaned `onCreated` addition to `ActivityComposer` was for, and the only piece of that file's diff this package actually needed.
- **A real cross-closure TypeScript narrowing issue, caught by `pnpm typecheck` before it shipped**: `today.data` guarded by `today.data &&` in JSX does not stay narrowed inside a `.map()` callback's separate function scope. Fixed by extracting a `TodaySections` component that receives the already-narrowed `data` as a typed prop, rather than threading a non-null assertion through the closure.
- **A jsdom-only test finding, not a product bug**: Radix's `Tabs.Trigger` activates on `mousedown`/`focus`, not `click` (confirmed by reading `@radix-ui/react-tabs`'s own source) — `fireEvent.click` in a test silently did nothing. Tests use `fireEvent.mouseDown`, the same class of jsdom/Radix pointer-event gap already recorded for the pipeline board's dropdown in D49. Because jsdom's `mousedown` also triggers `focus`, and Radix's trigger calls `onValueChange` from both handlers, the test asserts on the *last* navigation call, not an exact call count.
- **Docker Desktop needed a manual restart** before the API test suite could reach `crm_test` (same as the documented §4 startup note — it was not already running at session start); no code or configuration was touched to work around it.
- **Testing**: 1 new `apps/api` test (`GET /activities?priority=`), plus corrected/extended assertions in `tests/workspace/workspace.test.ts`; 8 new `apps/web` component tests (`tasks-page-client.test.tsx` ×5, `today-page-client.test.tsx` ×3). `pnpm typecheck && pnpm lint && pnpm --filter api test && pnpm --filter web test && pnpm build` all pass clean (296 `apps/api`, 87 `apps/web`, 383 total). Lint retains the same three pre-existing React Hook Form warnings. No schema, migration, permission, or dependency change. Browser/theme/focus/keyboard checks remain unverified — no browser was launched.

## D57 — Day 4 package 4.5: dashboard on Home (2026-11-23)

- **Loaded the `dataviz` skill before writing any chart code**, per its own trigger condition (any chart, in any library). Its method — pick the form, assign colour by job, validate, mark specs, hover layer, accessibility pass — was followed, but the colour-validation step was satisfied by reusing this project's own already-published, already-contrast-checked design tokens (`--data-1`..`--data-6`, `--success`/`--warning`/`--danger`/`--info`/`--accent`, documented and contrast-checked in `docs/design-system/README.md` §2) rather than running the skill's palette validator against a newly invented palette — there is no new palette here, only tokens this repository already ships and has already vetted.
- **Four single-series bar charts**, each a `DashboardBarChart` (new, `components/dashboard/dashboard-bar-chart.tsx`): leads by source (plain `--data-1`), leads by status (coloured per bar by `leadStatusChartColor`, a new helper in `lead-presentation.ts` reusing the exact same tone mapping `leadStatusBadgeVariant` already uses for the Leads list's status badges — status colour reused for literal status data, not repainted onto an unrelated series), pipeline by stage (`--data-6`, `OPEN`-type stages only, matching the Kanban board's own Won/Lost exclusion, D49), and monthly won revenue (`--success`, since it is specifically *won* revenue). One axis each; no dual-axis chart. Colours are passed as literal `var(--token)` strings straight into Recharts' `fill` props — confirmed this resolves correctly as a CSS custom property on an SVG presentation attribute in a browser, and (being the same string in both themes' stylesheets) repaints automatically on the light/dark toggle with no JS theme-detection logic needed.
- **Accessibility**: each chart is a `<figure aria-label>` with the actual `ResponsiveContainer`/`BarChart` marked `aria-hidden` (it is decorative/duplicate) and a `sr-only` `<table>` carrying the same label/value rows for screen readers — this is also what made the chart content testable in jsdom, where Recharts' `ResponsiveContainer` renders at zero width/height (no `ResizeObserver` in jsdom; confirmed by reading `recharts`' own source — it checks `typeof ResizeObserver === 'undefined'` and simply skips observing rather than throwing, but the chart itself still has no real layout to assert against). Tests query the hidden table's text, not the SVG.
- **KPI cards**: a new `StatCard` (`components/ui/stat-card.tsx`) built from `docs/design-system/components/StatCard/README.md` + `bundle.css` (`.gs-card`/`.gs-stat-label`/`.gs-stat-value`), no delta line (the dashboard API has no prior-period comparison to show one against). The brief names nine KPI cards; the StatCard README caps a dashboard at six — logged as a direct conflict resolved in the brief's favour (the PRD/roadmap's literal, explicit field list is the source of truth over a general design-system guideline, per `CLAUDE.md`), not silently decided either way.
- **Date range**: "This month" (default) omits `from`/`to` entirely, relying on the existing server-side organisation-month default (D53); "Last 30 days" computes an explicit `from`/`to`; "Custom range" exposes two date inputs, the same pattern as Leads' `createdFrom`/`createdTo` (D38) — plain browser-local dates, not organisation-timezone-converted, matching that existing convention rather than inventing a stricter one just for this screen.
- **A real `react-hooks/purity` compiler error, caught by `pnpm lint` before it shipped**: computing the 30-day window called `Date.now()` directly in the render body, which the installed React Compiler ESLint plugin (`validateNoImpureFunctionsInRender`) flags as an error — confirmed by reading the compiler's own shape table, which marks only `Date.now`/`Math.random`/`performance.now` as impure (a `new Date(someNumber)` constructor call is not flagged). Fixed by reading "now" once via `useState(() => new Date())`'s lazy initializer — React's own documented escape hatch for exactly this case — and deriving the 30-day bounds from that captured value instead of calling `Date.now()` inline.
- A `DashboardResponse` type was added to `packages/shared` (`workspace.ts`/`index.ts`) — the schema already existed from package 4.2 (D53); only the inferred type alias the frontend needs to import was missing, the same gap `TodayResponse` had before this package. `activityRecordHref` (lead/contact/company/deal link resolution) was promoted from a private helper duplicated once already (`tasks-page-client.tsx`, package 4.4) into the shared `activity-presentation.ts`, and `/tasks` was updated to import it instead of keeping its own copy — reuse found and fixed while building the dashboard's own "Recent activity" list, which needed the identical logic.
- **Testing**: 4 new `apps/web` component tests (`dashboard-page-client.test.tsx`) — every KPI value renders from the response; every chart's hidden table and the recent-activity list render correctly for an empty range with zeroed KPIs; the scope toggle defaults to `all` and clicking Mine updates the URL; the Last-30-days range computes a real 30-day `from`/`to` window. No `apps/api` change this package (the dashboard endpoint and its metrics were already built in 4.2/4.2b). `pnpm typecheck && pnpm lint && pnpm --filter api test && pnpm --filter web test && pnpm build` all pass clean — **296 `apps/api` + 91 `apps/web` = 387 total**. Lint retains the same three pre-existing React Hook Form warnings. No schema, migration, permission, or dependency change (`recharts@3.11.0` was already pinned in package 4.3's prep commit, `064a0f7`, and used here for the first time, unchanged). Browser/theme/focus/keyboard checks, and an actual look at the rendered charts, remain unverified — no browser was launched.

## D58 — Package 4C, Part A: how the staging API actually targets the `sales` schema (2026-11-23)

- **The task.** A new Supabase project ("growspark-workspace", Mumbai) will host staging, shared later with two other apps. This app must live only in a schema called `sales`, connecting as a role `sales_app` that can create objects only there (no `CREATEDB`/`CREATEROLE`/`CREATE EXTENSION`, no `CREATE` on `public`). Local dev/test must keep using the default (`public`) schema, unchanged, switched on only by an env var for staging.
- **Local stand-in used for every test below**, since the real Supabase role/pooler/TLS cannot be reached from here: a throwaway database (`crm_staging_sim`) in the existing local Docker Postgres, with a non-superuser role `sales_app_sim` (`rolsuper=f`, `rolcreatedb=f`, `rolcreaterole=f`, `rolbypassrls=f`, confirmed by query) owning only a `sales` schema it created (`CREATE SCHEMA sales AUTHORIZATION sales_app_sim`), with no `CREATE` privilege on `public` (confirmed via `has_schema_privilege`). **Neither this stand-in nor its findings prove anything about the real Supabase project's actual TLS handshake or session-pooler behaviour — only that this app's own SQL and Prisma usage do not require privileges `sales_app` won't have, and that the schema-targeting mechanism below is real and tested, not assumed.**
- **No migration needs a privilege `sales_app` won't have.** Checked every statement in `prisma/migrations/20261118202744_init/migration.sql`: no `CREATE EXTENSION`, no `CREATE DATABASE`, no superuser-only statement. UUIDv7 ids are generated client-side by Prisma (the `id` column is a plain `UUID NOT NULL` with no server-side `DEFAULT`), not by a database function — so there was never a `pgcrypto`/`uuid-ossp` dependency to worry about. `prisma migrate deploy`, run as `sales_app_sim` with `?schema=sales` on the connection string, applied cleanly; all 19 tables and `_prisma_migrations` landed in `sales`, nothing in `public` (confirmed via `information_schema.tables`).
- **The `?schema=` URL param only steers `migrate`, not the runtime Client — tested three ways, all failed before the real fix was found.** With `@prisma/adapter-pg` (this app's driver, not Prisma's classic binary engine): (1) `?schema=sales` in `DATABASE_URL` alone — the Client still queried `public.organizations` and failed; (2) a role-level `ALTER ROLE sales_app_sim IN DATABASE crm_staging_sim SET search_path = sales` — confirmed working for raw `pg.Pool` and plain `psql` (both correctly saw `search_path = sales` and could query unqualified `organizations`), but the Prisma Client *still* failed the same way; (3) regenerating the Prisma Client itself with `DATABASE_URL` pointed at `?schema=sales` — still failed. Prisma's TypeScript query compiler does not consult the connection's `search_path` or the URL at all for schema-qualifying generated SQL; absent other configuration it hardcodes `public`.
- **Confirmed fix: `@prisma/adapter-pg`'s own `schema` constructor option** (`PrismaPgOptions.schema?: string`, "the name of the schema to use in generated queries" — found by reading the adapter's shipped `.d.ts`, not guessed). `new PrismaPg(pool, { schema: 'sales' })`, with the role-level `search_path` reset back to default first (so only this option was doing the work), correctly read, wrote, and deleted rows in `sales.organizations` and never touched `public`. This needed **no change to `schema.prisma`** — not Prisma's `multiSchema` feature, which was tested as a fallback and does work (confirmed: `schemas = ["sales"]` on the datasource plus `@@schema("sales")` on all 26 models/enums produces a client that correctly targets `sales`) but bakes the schema name statically into the generated client, which would have forced a second, parallel-generated client and build step just to keep local dev on `public`. The adapter option needs none of that: `apps/api/src/db/prisma.ts` passes `env.DATABASE_SCHEMA ? { schema: env.DATABASE_SCHEMA } : undefined` — unset (local dev/test) behaves exactly as before, set (staging) retargets the same generated client with no rebuild.
- **Chosen mechanism, in 3 lines**: DATABASE_URL's `?schema=sales` query param steers `prisma migrate deploy` (and where `_prisma_migrations` lands); `DATABASE_SCHEMA=sales`, read by `apps/api/src/db/prisma.ts`, is passed as `@prisma/adapter-pg`'s own `schema` option and steers every runtime query; both are env vars, both no-ops when unset, no `schema.prisma` change. TLS and the real session pooler remain unverified until the real Supabase commands run (Part C stop point).

## D59 — Package 4C, Part B: DATABASE_SCHEMA/URL consistency guard and the local-only database-host guard (2026-11-23)

- **New, independently-testable pure functions** in `apps/api/src/lib/database-config-guards.ts`: `checkDatabaseSchemaConsistency(databaseUrl, databaseSchema)` and `checkLocalDatabaseHost(databaseUrl)`, each returning `null` or a message string — no `process.exit` inside either, so tests call them directly instead of simulating process termination.
- **DATABASE_URL's `?schema=` and DATABASE_SCHEMA must always agree** (direct instruction, 2026-11-23): wired into `envSchema`'s `.superRefine` in `src/env.ts`, so a mismatch fails Zod validation — and therefore `loadEnv()`'s existing process.exit(1) path — with a message naming both values (schema names, never secrets) and `path: ['DATABASE_SCHEMA']`. This is a pure function specifically so the same check can be reused, unchanged, by the Part C staging scripts, which load `.env.staging.local` directly and never import `src/env.ts` at all.
- **Local dev and test must refuse to start against a non-local DATABASE_URL** (direct instruction, 2026-11-23, scoped to local dev/test only after the user caught that an unscoped version would also block the staging scripts and the Render production runtime): wired into the same `.superRefine`, gated on `value.NODE_ENV !== 'production'`. Accepts `localhost`, `127.0.0.1`, `::1`. Never runs for `NODE_ENV=production` (Render genuinely connects to Supabase) and never runs for the staging scripts (they never import `src/env.ts`), so no exemption flag or special-casing was needed in either of those — they are exempt by construction, not by a bypass someone could leave enabled by accident.
- **`env.ts` now exports `parseEnv(raw)`** (the schema's `safeParse`, unwrapped from the process.exit-on-failure wrapper) specifically so tests can assert on validation outcomes, including both guards above, without actually terminating the test process. `loadEnv()` (still the module's only side-effecting call, still building the exported `env` singleton) now calls `parseEnv(process.env)` internally instead of duplicating the `safeParse` call.
- **Everything else Part B asked for already existed before this package and needed no change**, verified by reading the code rather than assumed: the allowed-origin env var (`ALLOWED_ORIGINS`, already used in `middleware/csrf.ts`'s Origin check, already tested in `tests/middleware/csrf.test.ts`); Secure cookies gated on `NODE_ENV === 'production'` (`lib/cookies.ts`, already tested in `tests/auth/login.test.ts`); and env validation that names the failing variable but never prints its value (`loadEnv()`'s existing error-printing loop only ever joins `issue.path` and `issue.message`, never the raw env value — confirmed by reading it, and the new guards' own messages follow the same rule, asserted directly in `database-config-guards.test.ts`: a rejected non-local `DATABASE_URL` names the host but not the credentials in the same connection string).
- **Testing**: 11 new tests in `tests/lib/database-config-guards.test.ts` (both guard functions, agreement/disagreement/unset cases, unparsable-URL cases, and the no-credential-leak assertion) and 8 new tests in `tests/env.test.ts` (the full `parseEnv` wiring: valid minimal config, both guards' failure and success paths, and the production bypass of the local-host guard). `pnpm typecheck` and `pnpm lint` clean on every changed/new file; full `apps/api` suite re-run after the `env.ts`/`db/prisma.ts` change — **296 + 19 new = 315 passing**. No schema, migration, permission, or dependency change.

## D60 — Package 4C, Part B: TRUST_PROXY on Render closes the D21/D23 "revisit at deployment" note (2026-11-23)

- **D21/D23 left one open question**: real per-client-IP rate limiting was deferred pending "the actual network path in front of both apps," once known at deployment. That path is now known: Next.js's `rewrites()` proxy (browser → Next.js on Render → Express API on Render, two separate Render services) — the same mechanism already measured in D21, which forwards neither `X-Forwarded-For` nor `X-Forwarded-Proto`, regardless of which platform runs it. Render's own edge network sits in front of each service and does set real forwarding headers for a request that reaches that service directly, but Next's rewrite still breaks the chain one hop further upstream before Express ever sees it — so a browser request's real IP still never reaches Express through this path on Render, exactly as it doesn't locally.
- **Conclusion: `TRUST_PROXY` stays `false` on Render too — no code change, closed by documentation.** Grepped the whole of `apps/api/src` for anything that reads `req.secure`/`req.protocol`/`X-Forwarded-*` directly: nothing does (the only hits are D21's own code comments). Nothing in this codebase would behave differently with `TRUST_PROXY` set to a hop count on Render, and setting one would trust a header this specific deployment topology gives no genuine reason to trust. Real per-browser-IP limiting still needs a different network path (a reverse proxy in front of both apps that Next is also configured to forward through) and is still deferred, not abandoned — unchanged from D23.
- Documented in `docs/STAGING.md` (Part D) as the value to set (`TRUST_PROXY=false`) and why, rather than leaving a future reader to wonder if it was simply forgotten.

## D61 — Package 4C, Part A completion: connection pool size and TLS CA support (2026-11-23)

- **`DATABASE_POOL_MAX`**, new optional env var, default 10 (`pg.Pool`'s own built-in default — local dev's behaviour is unchanged whether this var exists or not). `apps/api/src/db/prisma.ts` passes it straight through as `new Pool({ ..., max: env.DATABASE_POOL_MAX })`. Staging sets it to 5, per the original brief ("Keep the connection pool small and configurable... because the free tier has few connections").
- **`DATABASE_SSL_CA`** (new, optional) and **`DATABASE_SSL_REJECT_UNAUTHORIZED`** (new, optional, "true"/"false" string only — explicitly not `z.coerce.boolean()`, which coerces via JS's `Boolean(value)` and would make the literal string `"false"` parse as `true`, exactly backwards for a flag whose whole purpose is to default to off). Implemented in a new, independently-testable pure function, `resolveDatabaseSsl()` in `apps/api/src/lib/database-ssl.ts`: unset in local dev (returns `undefined` — no TLS config passed to `pg` at all, same as before this package); `DATABASE_SSL_CA` in staging — a file path or pasted PEM content (detected by whether the value starts with `-----BEGIN`) — verifies Supabase's certificate chain properly; `DATABASE_SSL_REJECT_UNAUTHORIZED=false` is a deliberately insecure escape hatch, off by default, only for if certificate verification cannot be made to work some other way. **Not used today** — nobody has set it, and doing so for real should get its own decisions.md entry at that time explaining why verification couldn't be made to work, not just point back to this one.
- **A CA file that cannot be read fails loudly with a clear message naming the path**, not a bare Node `ENOENT` deep inside a TLS handshake — wrapped in `src/lib/database-ssl.ts` with the original error attached as `cause` (satisfies this repo's `preserve-caught-error` lint rule, caught by `pnpm lint` before it shipped).
- **Still cannot be verified against the real Supabase session pooler or its actual certificate chain from here** — `resolveDatabaseSsl()` itself is fully unit-tested (pasted PEM, a real file on disk via a temp directory, a missing file's error message, and the `rejectUnauthorized: false` precedence over a CA value), but TLS behaviour against the genuine remote endpoint is a Part C stop-point item, same as the rest of Part A's "cannot verify until the real commands run" caveat (D58).
- **Testing**: 5 new tests in `tests/lib/database-ssl.test.ts`, 4 new tests in `tests/env.test.ts` (`DATABASE_POOL_MAX` default and override, `DATABASE_SSL_REJECT_UNAUTHORIZED` "false"-string parsing and its rejection of anything else). `pnpm typecheck` and `pnpm lint` clean. Full `apps/api` suite re-run after the `db/prisma.ts` change (adds `max`/`ssl` to the `Pool` constructor) — 315 + 9 new = 324 passing. No schema, migration, permission, or dependency change.

## D62 — Package 4C, Part C: staging scripts (`staging:migrate`, `staging:create-admin`, `staging:seed-sample`) (2026-11-23)

- **`apps/api/prisma/seed-lib.ts` split in two**, since the local-dev seed had the baseline organisation (org, lead sources, pipeline, stages) and the two demo users (`admin@growspark.test`/`staff@growspark.test`) mixed in one `runSeed()` — exactly the mixing the brief asked to check for. `seedBaselineOrganization()` is the part every environment needs, with no demo accounts attached; `seedDemoUsers(organizationId)` is the two hard-coded local-only accounts. `runSeed()` (still what `pnpm db:seed` calls) now just calls both in sequence — behaviourally identical to before, confirmed by the existing `tests/schema/seed.test.ts` idempotency test passing unchanged. The staging bootstrap script calls `seedBaselineOrganization()` directly and never `seedDemoUsers`/`runSeed` — staging structurally cannot get the two demo accounts, not merely by convention.
- **New `src/lib/bootstrap-admin.ts`** (`createFirstAdmin`) creates an Admin user outside the normal authenticated request path, for exactly the case the existing `users.service.ts`'s `createUser` can't handle: there is no existing user yet to be the audit row's actor. The new user is recorded as its own audit actor (`actorId: user.id` on its own `user.created` row) — the only sensible choice for the very first account in a brand-new organisation, and consistent with this app's existing rule that an audit row's actor is never null. Input is validated through the same `createUserSchema` the real Users API uses (role fixed to `ADMIN`), so password/email/name rules never drift between the two paths. A duplicate email surfaces as a friendly message, not a raw Prisma `P2002`.
- **New `scripts/lib/load-staging-env.ts`** (`loadStagingEnv`/`checkStagingEnv`) is what every staging script calls first, before any dynamic import of `src/env.js`/`src/db/prisma.js` (same "dynamic import after an env override" pattern `tests/setup.ts` already established, for the same reason: those modules read `process.env` the instant they're imported). It: refuses with a clear message naming the path if `apps/api/.env.staging.local` doesn't exist yet (pointing at the `.example` file to copy); refuses unless that file sets `NODE_ENV=production` (which is also what exempts `env.ts`'s local-only database host guard — D59 — for a script that's supposed to be targeting Supabase); and re-runs the exact same `DATABASE_URL`/`DATABASE_SCHEMA` agreement check `env.ts` itself will run moments later once imported, so a mismatch is caught with a message naming this file specifically, before anything has connected to a database at all. Prints only the database host and schema name on success, matching `db-reset.ts`'s existing convention of announcing a script's target before it does anything. Split into a process.exit-free `checkStagingEnv(path)` core and a thin `loadStagingEnv()` CLI wrapper — the same split `env.ts`'s `parseEnv`/`loadEnv` already uses — specifically so this could be unit-tested against a fake local file (never a real one, never actually run) rather than only exercised by a human running the real command.
- **`pnpm staging:migrate`** (`scripts/staging-migrate.ts`): `loadStagingEnv()` then `execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { stdio: 'inherit' })` — the exact same child-process pattern `scripts/db-reset.ts` already uses for `prisma migrate reset`. The staging `DATABASE_URL`/`DATABASE_SCHEMA` already loaded into `process.env` by `loadStagingEnv()` are inherited by the child process; `prisma.config.ts`'s own `.env`-file load (`apps/api/.env`, the local dev file) only fills in variables that aren't already set (D22/D23's documented `process.loadEnvFile` behaviour), so it cannot override them.
- **`pnpm staging:create-admin`** (`scripts/staging-create-admin.ts`): prompts for name, email, and a password via a masked prompt (`scripts/lib/prompt.ts` — Node has no built-in hidden-input readline mode, so this reads raw keypresses and echoes `*`, the standard pattern for this; refuses immediately if stdin isn't a real TTY rather than hanging or reading garbage). **Never reads a password from `process.argv`** — there is no code path in this script that looks at command-line arguments for it at all. Validates with the same `createUserSchema` fields as the real API, re-prompting on failure. Calls `seedBaselineOrganization()` (creating "Grow Spark Consulting", Asia/Kolkata, INR, lead sources, Sales Pipeline and stages if they don't already exist) then `createFirstAdmin()`.
- **`pnpm staging:seed-sample`** (`scripts/staging-seed-sample.ts`): refuses immediately unless `--confirm` is in `process.argv` (checked before `loadStagingEnv()` even runs, so a missing flag never gets as far as touching any config). Then runs the *exact same* `scripts/db-seed-sample.ts` local dev already uses, unchanged, as a child process (`execFileSync('pnpm', ['exec', 'tsx', 'scripts/db-seed-sample.ts'], ...)`) — it inherits the staging environment `loadStagingEnv()` already loaded into `process.env`, so there was no need to fork or parameterise that script at all.
- **This tool never ran any staging script** (direct instruction) — `staging:migrate`/`staging:create-admin`/`staging:seed-sample` were not executed, not even against the local stand-in. What *was* tested, against a fake local file or the local Docker Postgres only, never a real Supabase value: `checkStagingEnv()` (a temp directory holding a fake `.env.staging.local`-shaped file, exercising the missing-file, wrong-`NODE_ENV`, schema-mismatch and success paths — the success case's `DATABASE_URL` points at the same local `sales_app_sim`/`crm_staging_sim` stand-in built for D58, never anything real) and `createFirstAdmin()` (against `createTestTenant()`'s local test database).
- **A real test-isolation finding while writing `checkStagingEnv`'s tests**: vitest sets `NODE_ENV=test` and `tests/setup.ts` overrides `DATABASE_URL` to `TEST_DATABASE_URL` before any test file loads, and — per the same `process.loadEnvFile` behaviour recorded in D22/D23 — a fake staging file's own `NODE_ENV=production`/`DATABASE_URL=...` lines were silently ignored by the check under test, because those variables were already set. Two tests failed for a reason unrelated to the code being right or wrong. Fixed by explicitly `delete`-ing `NODE_ENV`/`DATABASE_URL`/`DATABASE_SCHEMA` in `beforeEach` (restored in `afterEach`) to simulate the clean process a real `tsx scripts/staging-migrate.ts` invocation actually starts from — not a workaround, a correction to a test that was passing one case for the wrong reason (vitest's own `NODE_ENV=test` happened to already make `!== 'production'` true) and failing another it should have passed.
- **Testing**: 4 new tests in `tests/lib/bootstrap-admin.test.ts` (real argon2 hash not plaintext, the self-referential audit actor, the shared schema's password-length validation, the friendly duplicate-email message) and 4 new tests in `tests/lib/load-staging-env.test.ts` (missing file, wrong `NODE_ENV`, schema mismatch, and the success path's host-and-schema-only output). `pnpm typecheck` (both `tsconfig.json` and `tsconfig.check.json`, which is what actually covers `scripts/`) and `pnpm lint` clean. Full repo `pnpm typecheck && pnpm lint && pnpm build` clean; full `apps/api` suite — 324 + 8 new = **332 passing**. No schema, migration, permission, or dependency change.

## D63 — Package 4C, Part C fix: `pnpm staging:migrate` failed on Windows before reaching Supabase (2026-11-23)

- **The bug, found by the user actually running it**: `scripts/staging-migrate.ts` called `execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], ...)` — the exact pattern already used by the pre-existing `scripts/db-reset.ts` and `scripts/db-verify-fresh.ts` (copied from there without re-checking it on this exact Node version). It failed with `spawnSync pnpm ENOENT`, never reaching the database. Root cause: on Windows, `pnpm` resolves to `pnpm.cmd`, a batch-file shim, and Node 22 refuses to spawn a `.cmd` file without an explicit shell — a deliberate hardening against [CVE-2024-27980](https://github.com/advisories/GHSA-qxp5-gwg8-xv66) (shell metacharacters in an argument could otherwise be interpreted by the shell that resolving a `.cmd` requires). `db-reset.ts`/`db-verify-fresh.ts` carry the exact same latent bug — **not fixed here, out of this package's scope, flagged to the user instead of silently worked around**.
- **Fix: run the real Prisma CLI file directly via `node`, no shell, no `pnpm`/`npx` in between.** New `scripts/lib/run-cli.ts` (`runPrismaCli`) resolves the installed `prisma` package's own declared `bin.prisma` entry (`require('prisma/package.json').bin.prisma`, currently `build/index.js` — the literal file `pnpm exec prisma` itself ultimately runs, just with one layer of shim resolution removed) and spawns it with `execFileSync(process.execPath, [entryPath, ...args], { stdio: 'inherit', cwd })`. `process.execPath` is the real `node`/`node.exe` binary, never a shell-dependent shim, so there is nothing to resolve through a shell and nothing to inject into.
- **`staging-seed-sample.ts` had the identical bug** (`execFileSync('pnpm', ['exec', 'tsx', 'scripts/db-seed-sample.ts'], ...)`) and is fixed differently, more simply: it no longer spawns a child process at all. `scripts/db-seed-sample.ts` doesn't load its own env file (it relies entirely on ambient `process.env`, unlike `seed.ts`/`db-reset.ts`), so `staging-seed-sample.ts` now just `await import('./db-seed-sample.js')`s it directly — the same "dynamic import after an env override" pattern `tests/setup.ts` already established, and the exact same script local dev's `pnpm db:seed:sample` already runs, unchanged, just reached without a subprocess.
- **`staging-create-admin.ts` never spawned a process at all** (pure in-process `readline`/Prisma calls) — nothing to fix there.
- **Testing**: 1 new test, `tests/lib/run-cli.test.ts`, mocking `node:child_process` to assert the spawned command is literally `process.execPath` (never a string containing `pnpm` or `prisma.cmd`), that the resolved entry path matches `prisma/.../build/index.js`, that the CLI's own args follow it unchanged, and that no `shell` option is ever passed. Full repo `pnpm typecheck && pnpm lint && pnpm build` clean; full `apps/api` suite — 332 + 1 new = **333 passing** (one flaky failure on an earlier run of the same unchanged suite did not reproduce on an immediate re-run — treated as transient, not a regression from this fix). This tool did not run `pnpm staging:migrate`/`staging:create-admin`/`staging:seed-sample` itself, per instruction.

## D64 — Package 4C: `APP_ENV`, and the sample seed's refusal was blocking staging for the wrong reason (2026-11-23)

- **The bug, found by the user actually running `pnpm staging:seed-sample -- --confirm`**: it failed with "The sample CRM seed refuses to run in production." `scripts/db-seed-sample.ts`'s guard refused whenever `NODE_ENV === 'production'` — which staging legitimately sets (D59, so the local-only database host guard is exempted). `NODE_ENV` alone cannot tell staging apart from the real Render production deployment; it was never designed to.
- **New `APP_ENV` env var** (`local` | `staging` | `production`, optional, **no default** — `src/env.ts`). Deliberately orthogonal to `NODE_ENV`: nothing else in this app (cookies, `TRUST_PROXY`, the local-host guard) reads it or changes behaviour based on it — this is purely the "which of these two `NODE_ENV=production` deployments is this" signal the seed guard needed, not a second copy of `NODE_ENV`. No default was the deliberate, safety-relevant choice: if it defaulted to `'local'`, a real production environment that simply forgot to set it would read as `'local'` and the sample seed would run there *unconditionally* — exactly backwards from what the guard is for. "Missing" has to stay its own, refused case.
- **New `src/lib/sample-seed-guard.ts`** (`checkSampleSeedAllowed`) is the actual refusal logic, extracted into a pure function specifically so it could be tested without running the real script: `local` → always allowed, preserving `pnpm db:seed:sample`'s existing behaviour exactly; `staging` → allowed only with `--confirm` **and** `DATABASE_SCHEMA` literally equal to `"sales"` (a second, independent check beyond the flag — catches a staging-flagged config that got pointed at the wrong schema by accident, even if `DATABASE_URL`/`DATABASE_SCHEMA` otherwise agree with each other per D59's guard); `production`, unset, or anything unrecognised → always refused, with a message naming the actual value seen.
- **Local dev needs one new line to keep working**: since the old guard's `NODE_ENV === 'production'` check is gone and nothing defaults `APP_ENV`, `pnpm db:seed:sample` would refuse locally too without `APP_ENV=local` in `apps/api/.env`. Added to `apps/api/.env.example` (which this tool can edit) — **the user needs to add `APP_ENV=local` to their own real `apps/api/.env`**, which this tool cannot and did not touch. `apps/api/.env.staging.local.example` gets `APP_ENV=staging` the same way, for the user's own `.env.staging.local`.
- **Verified, not assumed: the stray `"--"` from `pnpm staging:seed-sample -- --confirm` does not break the `--confirm` check.** Checked empirically with a throwaway, unrelated scratch script (`console.log(process.argv)`, removed immediately after) run via `pnpm <script> -- --confirm` in this exact installed pnpm version (11.10.0): `process.argv` comes through as `[...,'--','--confirm']` — the `"--"` is forwarded literally, not stripped, but `Array.prototype.includes('--confirm')` finds it regardless of what else is in the array. No code change was needed for this part; the existing check in both `db-seed-sample.ts` and `staging-seed-sample.ts`'s outer fast-fail was already correct. Locked in with a one-line test (`tests/lib/sample-seed-guard.test.ts`) rather than left to be rediscovered by hand again later.
- **Testing**: 8 new tests in `tests/lib/sample-seed-guard.test.ts` (every `APP_ENV`/confirm/schema combination, plus the `"--"`-survives-`.includes()` guarantee) and 5 new tests in `tests/env.test.ts` (`APP_ENV` unset stays `undefined`, each of the three valid values, and rejection of an invalid one). `pnpm typecheck`, `pnpm lint` and the full `apps/api` suite all green (see the session log for the exact total once recorded). This tool did not run `pnpm staging:seed-sample` itself, per instruction.

## D65 — Package 4C milestone: `staging:migrate` and `staging:create-admin` ran successfully against the real Supabase project (2026-11-23)

- **Confirmed by the user, not by this tool** (which has never touched the real `apps/api/.env.staging.local` or run a staging script): `pnpm staging:migrate` applied the init migration into the `sales` schema on the real Supabase project, and `pnpm staging:create-admin` created the organisation and the first Admin there. This is the first real-world validation of D58's schema-targeting mechanism (the adapter-pg `schema` option) and D62's bootstrap flow against an actual remote Postgres — everything before this was verified only against the local `sales_app_sim`/`crm_staging_sim` stand-in.
- **What remains unverified**: the real `sales_app` role's exact grant boundaries beyond what was exercised (migrate + one admin insert); behaviour of the Supabase project once it's shared with the other two apps it's meant to host eventually; everything in P1/P2's eventual feature set against this live schema.
- See D66 for what this confirms about TLS specifically.

## D66 — TLS against the real Supabase session pooler: verification is ON, but via a version-specific aliasing that will change (2026-11-23)

- **The question**: `pnpm staging:migrate`/`staging:create-admin` succeeded with neither `DATABASE_SSL_CA` nor `DATABASE_SSL_REJECT_UNAUTHORIZED` set — i.e. `resolveDatabaseSsl()` (D61) returned `undefined`, passing no explicit `ssl` object to `pg.Pool` at all. Is certificate verification actually happening?
- **Verified empirically** (constructing a `pg.Client` with a connection string carrying `?sslmode=require` and no explicit `ssl` option, and inspecting `connectionParameters.ssl` without connecting to anything): **yes, verification is on.** `pg`/`pg-connection-string@8.23.1` (the version this repo pins) parses `sslmode` straight out of the connection string itself, independent of whatever is passed as the `ssl` option (an explicit `ssl: undefined` makes no difference). Supabase's own connection string includes `sslmode=require`, and this installed version's `pg-connection-string` currently treats `require` as an **alias for `verify-full`** — full certificate chain and hostname verification, using Node's default trusted CA bundle, which already includes whatever public CA signs Supabase's certificate. Confirmed by `pg-connection-string`'s own runtime warning (printed on first use of a `require`/`prefer`/`verify-ca` mode): *"these modes will adopt standard libpq semantics [...] in the next major version."*
- **The catch: this is a version-specific courtesy, not a guarantee, and it is explicitly scheduled to go away.** A future `pg-connection-string`/`pg` major version will make `sslmode=require` mean only "encrypt, don't verify identity" — the weaker, standard libpq meaning. If that major version is ever installed (a routine `pnpm update`, not a deliberate security decision), this exact configuration would silently stop verifying Supabase's certificate, with no error, no test failure, and no code change to flag it — only the dependency version would have moved.
- **Safest fix, proposed to the user**: change `DATABASE_URL` in `apps/api/.env.staging.local` (the user's own file; this tool did not and cannot edit it) from `&sslmode=require` to `&sslmode=verify-full` explicitly. Functionally identical today (since `require` already means `verify-full` in the installed version) and immune to the future change, because it names the strict mode directly rather than relying on `require`'s current, temporary aliasing. `pg-connection-string`'s own deprecation warning recommends exactly this. No code change needed in this repo either way — this is a one-line edit to the user's own connection string.
- `DATABASE_SSL_CA`/`DATABASE_SSL_REJECT_UNAUTHORIZED` (D61) remain unused and should stay that way; nothing here required them.

## D67 — Package 4C, Part D: `render.yaml` and `docs/STAGING.md` (2026-11-23)

- **`render.yaml`** (repo root): a Render Blueprint, two `web` services matching the architecture in D1 — `growspark-crm-api` (Express) and `growspark-crm-web` (Next.js). Both `region: singapore` — the closest Render region to the Supabase project's own Mumbai region, minimising API↔database latency; Render has no Mumbai region itself. `buildCommand` for each mirrors this repo's own root `pnpm build` exactly (`pnpm --filter @growspark/shared build && pnpm --filter api exec prisma generate && pnpm --filter api build`, scoped per service), via `corepack enable && corepack prepare pnpm@11.10.0 --activate` first since Render's build environment doesn't have the pinned pnpm version active by default. Every `envVars` entry uses `sync: false` — the blueprint names variables, never values; applying it in Render's dashboard prompts for each one, which is what "env var NAMES only" in the brief meant in practice, not just in the file's own content.
- **`startCommand` for the API is `node apps/api/dist/index.js`, not `pnpm --filter api start`.** Checked rather than assumed: `apps/api/package.json`'s own `start` script runs `node --env-file=.env dist/index.js`, and `node --env-file` was confirmed (empirically, `node --env-file=.env-does-not-exist -e "..."`) to exit non-zero when the file doesn't exist — which it never will on Render, where env vars are injected directly into `process.env` with no `.env` file involved at all. `src/env.ts` already reads `process.env` directly with no file-loading step of its own, so the compiled output runs correctly without that flag; using the package.json `start` script as-is would have crashed the API service on every boot.
- **`PORT` is deliberately not in the API service's `envVars` list.** Render assigns and injects its own `PORT` for every web service and expects the app to bind to it; `src/env.ts`'s `PORT` schema already reads `process.env.PORT` (defaulting to 4000 only when unset, i.e. only in local dev). Listing it in the blueprint would have prompted the user to set a value that should be left to Render.
- **`healthCheckPath`**: `/health` for the API (already a public route, D1/Day 1); `/login` for the web app — confirmed via `pnpm build`'s own route output (`○ /login`, a statically prerendered page) that it needs no authentication and returns 200 unconditionally, unlike `/` which redirects an unauthenticated visitor.
- **`API_INTERNAL_URL` only needs to be correct at runtime, not at build time** — checked by reading `apps/web/next.config.ts`: `apiInternalUrl` is read from `process.env` at module load, and Next's `rewrites()` is server behaviour evaluated when `next start` boots, not baked into the static `next build` output. So the web service's build doesn't need the API's URL at all, and doesn't need `DATABASE_URL`/Prisma generated either (web never imports Prisma) — its `buildCommand` was kept deliberately smaller than the API's rather than copying the root `pnpm build` script's full chain unnecessarily.
- **`docs/STAGING.md`**: the full walkthrough — what runs where, every `apps/api/.env.staging.local` variable and where its value comes from (including the `APP_ENV=staging` line D64 needs, called out as something to add to an already-existing file), the TLS finding from D66 in plain terms with the recommended `sslmode=verify-full` edit, the three staging scripts in order, beginner-level Render Blueprint clicking steps, the full env-var-to-enter table for both Render services (naming which values come from the user's own `.env.staging.local` and which come from a Render-assigned URL instead), how a redeploy works and that it never runs migrations automatically, Supabase's free-tier pausing and Render's free-tier cold starts (both documented as expected, not bugs), and why there is deliberately no `staging:reset` command (CLAUDE.md's "ask before anything destructive," mirrored by Prisma's own CLI refusing `migrate reset` without fresh consent).
- Not pushed — this tool never pushes (CLAUDE.md, standing rule); the user pushes when ready, and Render's GitHub connection then redeploys automatically on every future push to `main`.

## D68 — The real TLS bug: `sslmode` in `DATABASE_URL` silently discards `DATABASE_SSL_CA` entirely; one connection factory, consolidated (2026-11-23)

- **The report**: `pnpm staging:seed-sample -- --confirm` failed with `self-signed certificate in certificate chain` at the first real query, even with `DATABASE_SSL_CA` pointed at a freshly-downloaded Supabase CA cert and `DATABASE_URL` using `sslmode=verify-full`. `pnpm staging:migrate` still worked. **Permission note**: the user explicitly authorised this tool to *read* (never edit) real env files for this investigation; `.claude/settings.json`'s `Read(apps/api/.env.staging.local)` deny rule was removed accordingly (the matching `Edit(...)` deny stays — this tool still never writes it), and `apps/api/.env.staging.local` was read directly to diagnose this.
- **Root cause, found by reading `pg-connection-string`'s actual source (v2.14.1, `parseIntoClientConfig`)**: the mere *presence* of `sslmode` (or `sslcert`/`sslkey`/`sslrootcert`/`sslnegotiation`) anywhere in the connection string makes it reset `config.ssl` to `{}` and rebuild it **from the URL alone** — completely discarding whatever `ssl` object was passed separately to `new Pool(...)`/`new Client(...)`. Reproduced directly (constructing a `pg.Client` with both `sslmode=verify-full` in the string and an explicit `ssl: { ca }`, and inspecting `connectionParameters.ssl`): the explicit `ca` vanished, leaving plain `{}`. With no `sslmode` in the URL at all, the exact same explicit `ssl` object was preserved untouched. Confirmed this is not specific to `verify-full` — `sslmode=require` triggers identical discarding.
- **This corrects D66's conclusion, which was incomplete.** D66 established that `sslmode=require`/`verify-full` alone (with *no* `DATABASE_SSL_CA` set) happens to resolve to `{}` → Node's default trusted CA bundle, and treated that as "verification is on and safe." What D66 never checked is *whether Node's default bundle actually trusts Supabase's certificate* — it doesn't. A read-only raw TLS handshake to the real pooler host (`tls.connect()` after the Postgres `SSLRequest` preamble, no Postgres authentication at all) shows its certificate chain is signed by Supabase's own private root (`Supabase Root 2021 CA` → `Supabase Intermediate 2021 CA` → `*.pooler.supabase.com`), not a public CA. `authorized` came back `false` with exactly `SELF_SIGNED_CERT_IN_CHAIN` against Node's default bundle. Whether `staging:create-admin` happened to succeed earlier under a different `DATABASE_URL`/`sslmode` combination than what's in the file now is not fully reconciled — what matters going forward is fixed, not guessed at.
- **The fix: strip the `sslmode`-family params from the connection string whenever we also supply our own explicit `ssl` option, so `pg-connection-string` has nothing left to override it with.** New `stripPgConnectionStringSslParams()` in `src/lib/database-ssl.ts`, used only when `resolveDatabaseSsl()` returns something other than `undefined` — local dev (no `DATABASE_SSL_CA`/`DATABASE_SSL_REJECT_UNAUTHORIZED` set) is completely unaffected, still relies on whatever `sslmode` its own `DATABASE_URL` does or doesn't have. Verified end to end (constructing a real `pg.Client` with the stripped string plus the explicit `ca`): `connectionParameters.ssl` now correctly keeps `{ rejectUnauthorized: true, ca: <the real cert> }`. The downloaded Supabase CA cert itself was already the right one — the bug was entirely that it was never actually being applied.
- **Found and fixed a second, pre-existing connection factory while answering "does every code path share one":** `src/db/pool.ts` built its own separate `pg.Pool` for `/health/db`'s raw `SELECT 1`, with **neither** `DATABASE_POOL_MAX` **nor** any SSL config applied at all — it would have hit the identical TLS failure if ever exercised against staging/production. New `buildDatabasePoolConfig()` (also in `database-ssl.ts`) is now the single place a `Pool` config is built; `src/db/prisma.ts` exports its `pool`, `src/routes/health.ts` now imports that instead of building its own, and `src/db/pool.ts` is deleted. `db-seed-sample.ts`/`staging-create-admin.ts`/the new `staging-check-db.ts` were already correct on this point — they all import the one `prisma`/`pool` singleton from `src/db/prisma.ts`; there was never a *second* Prisma-side factory, only the health-check one.
- **New `pnpm staging:check-db`** (`scripts/staging-check-db.ts`): loads the staging env the same way every other staging script does, then runs `SELECT 1` through the exact shared `pool` and `prisma.organization.count()` through the exact shared `prisma` — proving the real connection factory works, not a separately-built diagnostic path that might behave differently. Prints only the database host, the schema, and `OK`/the failure message — never credentials (the failure message is whatever `pg`'s own TLS/connection error says, which never embeds the connection string).
- **With `DATABASE_SSL_CA` set, verification stays fully on.** `resolveDatabaseSsl()` returns `{ rejectUnauthorized: true, ca }` whenever `DATABASE_SSL_CA` is set and `DATABASE_SSL_REJECT_UNAUTHORIZED` is not explicitly `false` — there is no code path where supplying a CA quietly weakens verification. `DATABASE_SSL_REJECT_UNAUTHORIZED=false` is a separate, independent, off-by-default escape hatch (D61); nothing about this fix changes its behaviour or makes it any more or less likely to be on.
- **On Render specifically, `DATABASE_SSL_CA` must be the certificate's own PEM text pasted directly into the env var, not a file path** — Render's containers have no `D:` drive or any filesystem path the user controls to point at. `resolveDatabaseSsl()` already supports this (it checks for the `-----BEGIN` header to decide text-vs-path, so no code change was needed), but `render.yaml` and `docs/STAGING.md` both now say so explicitly (a new "The CA certificate on Render" section, plus a comment directly on the `DATABASE_SSL_CA` blueprint entry) — the Render env-var table previously and wrongly said to leave `DATABASE_SSL_CA` blank there, copied over from before this fix existed; corrected.
- **Testing**: 9 new tests in `tests/lib/database-ssl.test.ts` — `stripPgConnectionStringSslParams` (removes every param in the trigger set regardless of value, no-ops when there's nothing to strip, leaves an unparsable string alone) and `buildDatabasePoolConfig` (local dev passes `DATABASE_URL` through unchanged; the exact bug scenario — `sslmode` present plus an explicit CA — now correctly strips `sslmode` and keeps the CA; the insecure escape hatch is stripped the same way; `sslmode` is left alone when no explicit SSL config applies at all). `tests/health-db.test.ts` (pre-existing, unchanged) still passes against the consolidated `pool`, proving the consolidation didn't change `/health/db`'s behaviour. Full repo `pnpm typecheck && pnpm lint && pnpm build` clean; full `apps/api` suite — **347 + 12 new = 359 passing**. This tool did not run `pnpm staging:seed-sample`/`staging:check-db`/any staging script itself — the fix was verified with `pg.Client`'s own local, non-networked config resolution and a read-only, unauthenticated raw-TLS handshake to the real pooler hostname (no Postgres login attempted).

## D69 — Change of plan: web app moves to Vercel, API stays on Render as a manual Web Service, not a Blueprint (2026-11-23)

- **The decision**: `apps/web` is now hosted on **Vercel**; `apps/api` stays on **Render**, but as one manually-created Web Service rather than applying `render.yaml` as a Blueprint. D67's two-service-Blueprint plan is superseded for the web half only — the API's own settings (region, build/start commands, health check, env vars) are unchanged in substance, just created by hand instead of via **Apply**.
- **`render.yaml` is now documentation only, not applied.** Rewritten to describe just the API service, with a header comment explaining it's a reference for diffing the manual Web Service's settings against, not something to click "Apply" on. The web service block was removed entirely rather than left stale.
- **Checked the whole codebase for anything that assumed the two services lived together on Render (same account, same private network, same platform)** — found nothing needing a code fix. The reason: D21/D23 (package 1.3b, Day 1) had already established that the Next.js proxy in front of the API forwards neither `X-Forwarded-For` nor `X-Forwarded-Proto`, so `TRUST_PROXY` was already `false` on the assumption that nothing in front of the API could be trusted — a conclusion that holds identically whether that Next.js process runs on Render or on Vercel. Specifically checked and found platform-agnostic already: the Origin check (`csrf.ts`, driven purely by the `ALLOWED_ORIGINS` env var), `trust proxy` (`app.ts`/`env.ts`), the `Secure`-cookie flag (`cookies.ts`, driven by `NODE_ENV`, with no `Domain` attribute set — which is exactly what makes the cross-platform split work, since the browser scopes the cookie to whichever origin it sees the response coming from, regardless of where that response was actually generated), and the login rate limiter (`rate-limit.ts`, already a global flood ceiling rather than a per-IP limiter, per D21/D23). Confirmed no `cors` package exists anywhere in `apps/api` — there was never a CORS allow-list assuming same-origin-with-Render, because the browser was never meant to talk to the API's own origin directly in the first place, on Render or anywhere else.
- **The two platforms' URLs are mutually dependent inputs** (the API's `ALLOWED_ORIGINS` needs the Vercel URL; Vercel's `API_INTERNAL_URL` needs the Render URL), so first-time setup is necessarily a two-pass bootstrap: create the Render service first (with a placeholder `ALLOWED_ORIGINS`, since nothing should be writing to the API yet), create the Vercel project second (now the Render URL is known), then go back and fix the Render service's `ALLOWED_ORIGINS` to the real Vercel URL. Documented as "Order of operations" in `docs/STAGING.md`, with no code implication beyond both values already being plain env vars.
- **Vercel-side settings for this pnpm monorepo**: Root Directory `apps/web`, with "Include files outside the Root Directory" **on** (required — without it, the build never sees the repo-root `pnpm-workspace.yaml`/lockfile/`packages/shared`, since Vercel otherwise only uploads the Root Directory's own subtree). Install Command and Build Command both `cd ../..` first, since Root Directory makes that the commands' working directory but the `pnpm --filter` commands only resolve from the monorepo root; Build Command builds `@growspark/shared` before `web` for the same reason D9/D12 already required locally (the web app imports shared's compiled `dist`, not its TypeScript source) — skipping that ordering would reproduce D12's stale/missing-`dist` failure mode on Vercel instead of locally. Output Directory is left at its Next.js-preset default (`apps/web/.next`) — the `cd ../..` only affects where the *shell* starts; `pnpm --filter web build` still runs the actual `next build` with `apps/web` as its own internal cwd, so `.next` lands in the expected place regardless. Node.js Version set to 22.x in Project Settings, matching the repo's pinned `engines.node`. No `NODE_ENV` variable is added on Vercel — it sets this itself for Production builds, and the brief's own research confirmed manually adding it is unnecessary and risks diverging from Vercel's own build pipeline.
- **Confirmed (reasoned through from Next.js's documented external-rewrite behavior, not yet from a live login) that the `/api/*` rewrite still preserves cookies and the Origin check across the platform split**: Next.js's `rewrites()` to a fully-qualified external destination is a proxy, not a redirect — the browser's request and response both stay on the Vercel origin throughout. The browser's same-origin `fetch()` to `/api/...` still sends `Origin: https://<vercel-app>`, which Next's rewrite forwards to the API unmodified (not something the rewrite mechanism touches), so `ALLOWED_ORIGINS` on the API must hold the Vercel URL, not any Render address. The API's `Set-Cookie` response (no `Domain` attribute) is relayed back by the proxy unmodified, and the browser scopes it to the Vercel origin it actually talked to — the same reasoning that already made the cookie design platform-agnostic, now exercised across two different hosting platforms instead of two services on one platform. Flagged under `docs/STAGING.md`'s "What's still unverified" until confirmed by an actual sign-in against the live pair.
- **Nothing pushed, nothing deployed by this tool** — `render.yaml` and `docs/STAGING.md` are updated locally; the actual Render service and Vercel project still need to be created by hand in their respective dashboards, per CLAUDE.md's standing rule that this tool never pushes and the project owner does the actual deploy clicking.

## D70 — First real Render deploy attempt failed at the build step; fixed the Build Command and Node version, and pre-emptively corrected the same risk in the Vercel instructions (2026-11-24)

- **The report**: the user created the `growspark-crm-api` Render Web Service by hand per D69/`docs/STAGING.md` and the build failed immediately, with two findings in the log (a screenshot, not run by this tool): (1) `Requesting Node.js version >=22.12 ... Using Node.js version 26.13.1 via /opt/render/project/src/package.json`; (2) the Build Command's first real step, `corepack enable && corepack prepare pnpm@11.10.0 --activate && ...`, threw `Internal Error: EROFS: read-only file system, unlink '/usr/bin/pnpm'` with a stack trace through `corepack`'s own `EnableCommand.generatePosixLink` → `Build failed`.
- **Root cause 1 (Node version)**: the root `package.json`'s `engines.node` is `">=22.12"` — a lower bound only, no upper bound. Render's own current docs (`render.com/docs/node-version`, searched directly, not assumed) list `engines.node` as Render's lowest-precedence Node-version fallback, used only when nothing more specific is set — and explicitly warn "always include an upper bound in your version range," naming exactly this failure mode (an open-ended range resolving to an unexpectedly new major over time). **Fix**: added a `NODE_VERSION=22.20.0` environment variable to the Render service — per the same docs, `NODE_VERSION` is Render's **highest**-precedence Node-version source (above a `.node-version` file, above `.nvmrc`, above `engines.node`), so it pins the build to the exact version already used locally (`docs/PROJECT-STATE.md` §4) without touching `engines.node` itself or needing any repository change. `render.yaml` (documentation only, D69) updated to match, as a non-secret inline `value:` (not `sync: false`, unlike every other entry) since this is a fixed, non-secret, deployment-environment-specific constant, not something that varies per environment the way the rest of the table does.
- **Root cause 2 (the EROFS failure) — confirmed empirically by the error itself, then confirmed against Corepack's own docs, not guessed**: Render's current Node build image ships a pre-installed `pnpm` binary at `/usr/bin/pnpm` that the build user cannot write to. `corepack enable` (and the shim-installing half of `corepack prepare <pm>@<version> --activate`) works by creating/replacing shims for each package manager name in the directory next to wherever Corepack itself is installed — on this image, that resolves to `/usr/bin`, which is read-only to the build user. Read `nodejs/corepack`'s own README (GitHub) directly to find the fix rather than copying a community workaround verbatim: its "Utility Commands" section documents `corepack <binary name>[@<version>] [... args]` as a one-shot form — "this meta-command runs the specified package manager in the local folder" — that requires no prior `enable` step at all, downloads/caches the pinned version under `$COREPACK_HOME` (`$HOME/.cache/node/corepack` by default, not a system directory), and still checks the project's `packageManager` field for consistency ("you won't be able to run `corepack yarn install` on a project where the `packageManager` field references `pnpm`"). **Fix**: the Render Build Command now calls `corepack pnpm@11.10.0 <args>` for every step (`install --frozen-lockfile`, then each `pnpm --filter` build step) instead of `enable`ing/`prepare`ing first — functionally identical pinned-version behaviour, with nothing left that tries to write to `/usr/bin`. `render.yaml` updated to match (documentation only, still not applied as a Blueprint, D69).
- **Pre-emptively checked whether the Vercel instructions (also written this session, D69) had the identical latent bug** — they did: the Vercel Install Command override also read `corepack enable && corepack prepare pnpm@11.10.0 --activate && cd ../.. && pnpm install --frozen-lockfile`. Rather than assume Vercel's build image has the same read-only-system-path behaviour as Render's (plausible, but not confirmed either way — Vercel's docs don't mention it), checked Vercel's own current docs (`vercel.com/docs/deployments/configure-a-build#corepack`, `vercel.com/docs/package-managers`) for the documented way to pin a Corepack-managed package manager version there, and found the manual `corepack enable`/`corepack prepare` pair was wrong on Vercel for a different reason than on Render: **Corepack support on Vercel is opt-in**, via a project environment variable — "You can enable Corepack by adding an environment variable with name `ENABLE_EXPERIMENTAL_COREPACK` and value `1` to your Project" — and once set, Vercel's own install step (which runs *before* the project's configured Install Command) already honours the root `package.json`'s `"packageManager"` field itself, with no `corepack enable`/`prepare` needed in the Install Command at all. Without that env var, Vercel instead infers the package manager version from the lock file, and its documented lockfile-version → pnpm-version mapping does not list pnpm 11 — a silent version mismatch risk, not just redundant commands. **Fix**: the Vercel Install Command override is now just `cd ../.. && pnpm install --frozen-lockfile` (no Corepack commands at all), and a new required `ENABLE_EXPERIMENTAL_COREPACK=1` Vercel project environment variable was added alongside `API_INTERNAL_URL`.
- **Both fixes are Render/Vercel dashboard-only changes — neither needs a repository change or a push.** `NODE_VERSION`/the corrected Build Command are entered directly on the existing Render service (Settings → Build & Deploy, or Environment); `ENABLE_EXPERIMENTAL_COREPACK`/the corrected Install Command are entered when the Vercel project is first created (it hasn't been yet). `render.yaml` and `docs/STAGING.md` were updated so the next read of either already reflects the fix, but the running Render service itself still needs these edited by hand in its dashboard and redeployed — not done by this tool (no dashboard access).
- **Not independently re-verified against a live Render build by this tool** — the original failure was read from a screenshot, and the fix (Corepack's one-shot invocation form, Render's `NODE_VERSION` precedence, Vercel's Corepack opt-in) is confirmed against each platform's own current documentation, not from watching a corrected deploy succeed. Flagged for the user to confirm on the next real deploy attempt.

## D71 — Day 5 part (a) kickoff: plan approved, schema migration applied, mid-build design refinements recorded before a checkpoint stop (2026-11-24)

Day 5a (website intake, API keys, Enquiries inbox) started this session. The
user approved a plan (auto-create a Lead on intake, Enquiries visible to
both roles same as Leads, document API keys as intake-only rather than add
an unused scope column, keep the shared 100KB body limit rather than a
separate 64KB one for intake) and then, mid-build, sent eight binding
refinements. This entry records the approved design as it now stands,
**before most of it is actually built** — see `docs/DAY-5A-SUMMARY.md` for
exactly what code exists versus what is still only designed here.

- **Schema change — applied to `crm_dev` only, not yet to `crm_test` or
  staging.** Migration `20261123194049_add_submission_spam_and_archive`:
  adds `website_submissions.archived_at` (nullable timestamptz, same
  archive/restore pattern every other business record already has) and a
  `SPAM` value to the `submission_status` enum (alongside the existing
  `RECEIVED`/`LEAD_CREATED`/`REJECTED`). No other schema change — `ApiKey`
  already had every column this day's work needs (built Day 1), including
  on reflection no `scope` column, per the user's own "document only, don't
  add it" choice, since intake is the only purpose keys serve today.
  `apps/api/prisma/SCHEMA-SUMMARY.md` updated to match. **This migration has
  not been applied to `crm_test`** (confirmed by a failing pre-existing
  schema test, `tests/schema/website-submissions.test.ts`, once the shared
  package's two new unused files were added and the full suite re-run) —
  this tool does not read real `.env` files and does not run `prisma
  migrate reset`/`migrate deploy` against a database other than `crm_dev`
  without being asked each time (CLAUDE.md, and the Prisma AI-agent consent
  gate, D15); applying it to `crm_test` is the user's to do, documented as
  the first item in `docs/DAY-5A-HANDOVER-PROMPT.md`. **It must also be
  applied to staging eventually, by the user running `pnpm staging:migrate`
  themselves — not run against staging by this tool, per explicit
  instruction.** Exact migration name for that command:
  `20261123194049_add_submission_spam_and_archive`.
- **`scoped()` (`apps/api/src/lib/scoped.ts`) and the three duplicate
  finders (`apps/api/src/lib/duplicates.ts`) now take `{ orgId: string }`
  instead of the full `RequestContext`.** A deliberate, backward-compatible
  widening (every real `RequestContext` already has `orgId`, so no existing
  call site changes) — the intake code path has no human user at all (an
  API key, not a session), so it has no `userId`/`role` to put in a
  `RequestContext` and would otherwise need a fabricated fake one just to
  reuse this already-built duplicate-warning logic. Confirmed via
  `pnpm typecheck` (clean) that this change alone touches nothing else.
- **Enquiry → Lead flow (approved plan, not yet built)**: the intake
  endpoint creates a `Lead` immediately on a successful submission —
  exactly like the original Day-5 roadmap already specified — rather than
  leaving enquiries as a separate not-yet-a-lead state awaiting manual
  conversion. "Mark as spam" on an already-processed enquiry will also
  archive the `Lead` it created, in one transaction.
- **Honeypot handling — refined mid-build by direct instruction, overriding
  this entry's own first draft**: a tripped honeypot (`hp` field,
  non-empty) stores the submission with status **`SPAM`** (not `REJECTED`
  — `REJECTED` is reserved for a submission that fails real validation,
  e.g. no email or phone after mapping) and creates no `Lead`. The HTTP
  response is **identical in shape** to a real success (`201`, same
  envelope, `leadId: null`, `duplicate: false`) — the sender is never told
  it was caught. Noted honestly: a sufficiently determined prober could in
  principle notice that honeypot-triggered responses always carry a null
  `leadId` while a real, non-honeypot success practically never does
  (mapping requires an email or phone before a 201 is possible at all) —
  accepted as standard honeypot practice (fail invisibly, not
  undetectably-perfectly), not worth more engineering against.
- **API key format and verification (design finalised, implementation
  pending)**: a key is a long random value with a recognisable literal
  prefix (`gsk_live_` + 32 random bytes, base64url) — the prefix is
  cosmetic/recognisable only, not a lookup mechanism. Only a SHA-256 hash is
  ever stored (`keyHash`, already `@unique` on `ApiKey`), the same pattern
  `apps/api/src/lib/session.ts` already uses for session tokens. Lookup is
  `findUnique({ where: { keyHash } })` (exact, indexed), **plus** a
  `crypto.timingSafeEqual` comparison of the computed hash against the
  found row's stored hash before trusting it, per explicit instruction.
  Honestly scoped in the code comment: this is defense-in-depth layered on
  top of an already-exact indexed DB match, not a claim that it closes a
  timing side-channel the database index lookup itself might still have.
  `revokedAt` is checked on every single request (no caching) and rotation
  is revoke-old-plus-create-new in one transaction, so a revoked or rotated
  key stops working on its very next use, immediately.
- **Origin-check exemption — redesigned mid-build to be conditioned on
  success, not on path alone**: the first draft would have exempted the
  `/api/v1/intake/*` path from the Origin check unconditionally, before
  authentication ran. Corrected per direct instruction ("only when a valid
  API key is present... a request with a session cookie but no key must
  still be rejected"). The real design: a new middleware,
  `attachApiKeyContext`, is mounted globally but scoped to the intake path
  only (`app.use('/api/v1/intake', attachApiKeyContext)`), **before**
  `enforceOriginAndContentType` in `app.ts`'s middleware order. On a
  missing/invalid/revoked key it immediately rejects with `401` — the
  request never reaches the Origin check at all in that case, so a bad or
  absent key can never be masked by, or benefit from, a `403 Origin not
  allowed` instead. Only on success does it attach `req.apiKeyCtx`;
  `enforceOriginAndContentType` then exempts the Origin check (Content-Type
  is still required) if, and only if, `req.apiKeyCtx` is already set —
  which by construction can only be true on this one path, after
  authentication already succeeded. A session cookie with no
  `Authorization` header hitting this route is rejected at the
  `attachApiKeyContext` step with `401`, before CSRF logic is even reached
  — satisfying "must still be rejected" directly. A dedicated test for this
  (cookie-but-no-key → 401; no-Origin-but-valid-key → succeeds;
  valid-key-but-wrong-Content-Type → still `415`) is pending, tracked in
  `docs/DAY-5A-HANDOVER-PROMPT.md`.
- **Idempotency must win over body validation, not lose to it — a real
  design change from the first draft.** A repeat `Idempotency-Key` must
  return the original result and ignore the new body entirely, **even if
  the new body would otherwise fail validation** (direct instruction, with
  a test required: same key, different — and in the test, invalid — body,
  must still return the original result). This means the intake route
  cannot use `defineRoute`'s normal declarative `validate: { body: ... }`
  option, which runs unconditionally before any handler code: the
  (organizationId, externalId) lookup must run first, inside the service
  function, against the raw body, and only *after* finding no existing row
  does the service call `websiteEnquiryIntakeSchema.parse()` itself. This
  is a deliberate, documented exception to the "every route validates
  declaratively" convention, not an oversight — flagged inline in the
  route file once written. A genuinely malformed JSON body (not just a
  body that fails the Zod shape) is still caught earlier, by
  `express.json()` itself, before any of this runs — idempotency cannot
  rescue a body Express itself couldn't parse at all, which is an honest,
  unavoidable boundary, not a gap in this design.
- **Per-IP rate limiting on intake: implemented, but honestly caveated, not
  relied on as the real protection.** `TRUST_PROXY` stays `false`, per
  direct instruction not to change it without asking, and per D60's own
  finding that nothing in this deployment's network path gives Express a
  genuine client IP to trust. D60 only examined the *browser* path (through
  Next's rewrite); intake is called server-to-server directly against the
  API's own URL, which does skip that particular hop — but on Render, the
  platform's own edge/load balancer almost certainly still sits in front of
  the Express service for a direct hit too, so `req.ip` there likely shows
  Render's edge address, not the real calling website's address, collapsing
  the per-IP bucket into one shared counter in practice — the same failure
  mode D21 already found and abandoned for login, for a materially similar
  reason. **The per-key limiter is the real protection**; the per-IP
  limiter is kept as a cheap second layer that is honestly expected to do
  little to nothing once this runs on Render, not claimed otherwise.
  Documented in `docs/intake-contract.md` once written, not just here.
- **Logging and audit minimisation (direct instruction)**: `pino`'s
  existing redact list (`apps/api/src/logger.ts`) already covers
  `req.headers.authorization` (the API key) and never logs a request body
  at all (`request-log.ts` logs method/route/status/duration/userId only)
  — the `Idempotency-Key` header gets an explicit redact-path entry added
  too, defense-in-depth, consistent with the file's existing "in case a
  future change does" reasoning for headers nothing currently logs
  directly. Audit rows written for intake-created records carry only
  `submissionId` and the key's `keyPrefix` in `metadata` — never the raw
  key, the `Idempotency-Key` value, or any enquiry field (name/email/phone/
  payload). `actorId` is `null` on these rows (no human acted); the
  attribution is the API key, recorded by prefix only.
- **Rejected and spam submissions are kept, not deleted — explicitly a note
  for later, not a task for this session.** Every `WebsiteSubmission` row,
  whatever its status, stays in the table indefinitely (archiving only
  hides it from a default list view, per the column added above). No
  retention/deletion policy exists for any status, spam included. Whether
  one is needed is an open question for later — the PRD itself defers
  backup/retention/privacy policy to Day 7 documentation, not engineering,
  and this entry does not change that. Recorded here only as an explicit
  note, per direct instruction not to build anything for it now.
- **Nothing has been run against staging, and nothing will be by this
  tool.** The user runs `pnpm staging:migrate` themselves, against
  migration `20261123194049_add_submission_spam_and_archive`.
- **Checkpoint stop**: per the user's own instruction, build work paused
  here — mid-plan, with the schema change applied and two new unused
  shared-package files on disk (`packages/shared/src/api-keys.ts`,
  `packages/shared/src/intake.ts`, neither yet exported from `index.ts` or
  imported anywhere) — to run the full check suite and bring the docs up to
  date before continuing. `pnpm typecheck` and `pnpm lint` are clean (0
  errors; 3 pre-existing warnings in files untouched this session). `pnpm
  test`: `apps/web` 91/91 pass; `apps/api` 358/359 pass, the one failure
  being the pre-existing `website-submissions.test.ts` schema test hitting
  `crm_test`, which does not yet have this session's migration applied —
  not a code defect, and not something this tool can fix itself per the
  constraint above. Full remaining work list in
  `docs/DAY-5A-HANDOVER-PROMPT.md`.

## D72 — Day 5a resumed and completed: API keys, website intake, and the Enquiries backend built per D71 (2026-11-24)

The user confirmed `crm_test` had the migration applied (`pnpm db:verify-fresh`,
run by the user themselves after this tool found and fixed an unrelated
Windows bug in that script — see the paragraph below), then asked this
session to build the entire remaining D71 plan in order, reporting only at
named checkpoints rather than after every package. This entry covers items
2–12 of `docs/DAY-5A-HANDOVER-PROMPT.md`: everything backend. D73 covers the
frontend (item 13).

- **Pre-existing bug fixed first, at the user's own request, before any of
  D71's plan**: `pnpm db:verify-fresh` failed with `spawnSync pnpm ENOENT` —
  the exact Windows `.cmd`-shim/CVE-2024-27980 problem D63 already diagnosed
  and fixed for `staging-migrate.ts`, but explicitly left unfixed in
  `db-verify-fresh.ts`/`db-reset.ts` at the time ("not fixed here, out of
  this package's scope"). Both now use the same `runPrismaCli()` helper
  (`scripts/lib/run-cli.ts`) D63 already built and tested — `db-reset.ts` is
  a direct swap (it never needed a custom `env`), `db-verify-fresh.ts` sets
  `process.env.DATABASE_URL` to `TEST_DATABASE_URL` before calling it, since
  `runPrismaCli` has no `env` parameter and `execFileSync` inherits
  `process.env` by default. No new test added — the only thing that changed
  is which already-tested helper does the spawning (`tests/lib/run-cli.test.ts`
  already covers `runPrismaCli` itself), and neither script had, or per the
  `staging-migrate.ts` precedent needs, its own dedicated test.
- **`lib/api-key.ts`**: `generateApiKey()` (`gsk_live_` + 32 random bytes,
  base64url — `API_KEY_PREFIX` is a named export, cosmetic only, never used
  for lookup), `hashApiKey()` (SHA-256, identical pattern to
  `session.ts`'s `hashSessionToken`), `verifyApiKeyHash()`
  (`crypto.timingSafeEqual`, length-checked first since that function throws
  on mismatched buffer lengths). `keyPrefix` stored for display is the first
  15 characters of the generated key (`gsk_live_` plus 6 random chars) — a
  judgment call not specified in D71: enough to tell keys apart in the list
  screen, nowhere near enough to reconstruct the real key.
- **`middleware/api-key-auth.ts`** (`attachApiKeyContext`) and a new
  `ApiKeyContext` type in `lib/context.ts` (mirrors `RequestContext` but for
  the no-human-user intake path): parses `Authorization: Bearer <key>`,
  hashes it, `findUnique({ where: { keyHash } })`, checks `revokedAt` fresh
  on every request (no caching), then the `timingSafeEqual` comparison
  before trusting the match. On any failure: `401`, immediately, before
  anything else runs. On success: updates `lastUsedAt` and attaches
  `req.apiKeyCtx = { organizationId, apiKeyId, keyPrefix }`.
- **`middleware/csrf.ts`**: the Origin-check exemption, exactly as D71
  specified — conditioned on `req.apiKeyCtx` already being set, never on the
  request path. The Content-Type check is never exempted. Mounted in
  `app.ts` as `app.use('/api/v1/intake', attachApiKeyContext)`, **before**
  `enforceOriginAndContentType` and before `express.json()` (neither of
  those needs the parsed body, so the ordering has no other side effect).
- **`lib/route-registry.ts`**: `'apiKey'` added to the `RouteAuth` union;
  `defineRoute` skips both `attachSessionContext` and `requirePermission`
  for it (auth already happened in the global middleware above by the time
  an `'apiKey'` route's own chain runs). `route-registry.test.ts` updated
  per D71's instructions: the existing "declares public/authenticated/a real
  permission" test now also allows `'apiKey'`, plus a new test asserting the
  apiKey-auth allow-list is exactly `['POST /api/v1/intake/website-enquiries']`.
- **`lib/rate-limit.ts`**: `intakeKeyRateLimiter` (60/minute per
  `req.apiKeyCtx.apiKeyId` — every request counts, not just failed ones,
  unlike the login limiters: this bounds request *volume*, not brute-forcing)
  and `intakeIpRateLimiter` (120/minute per `req.ip`), both documented
  inline with D71's honest caveat about the per-IP one on Render given
  `TRUST_PROXY=false` (D60, untouched).
- **`logger.ts`**: added `'req.headers["idempotency-key"]'` to the existing
  redact list, defense-in-depth consistent with the file's own "in case a
  future change does" reasoning. Confirmed (did not re-add)
  `req.headers.authorization` was already redacted, and that
  `request-log.ts` only ever logs method/route/status/duration/userId —
  never a header or body directly.
- **`modules/api-keys/`** (Admin only, `PERMISSIONS.SETTINGS_MANAGE`):
  `createApiKey`, `listApiKeys` (never returns a hash or the raw key —
  `keyPrefix` only), `revokeApiKey` (409 `ALREADY_REVOKED` on a second
  call, same convention as every other archive-style 409), `rotateApiKey`
  (revoke-old-plus-create-new in one transaction, new key keeps the old
  key's name). `POST`/rotate return the raw key exactly once, in
  `apiKeyCreatedResponseSchema`'s distinct shape — never the same shape
  `GET` returns.
- **`modules/intake/`** — three files, per D71's own breakdown:
  - `intake-mapping.ts` (`mapIntakeFields`): the lenient field mapper. A
    short alias list per target field (e.g. email only ever tries `email`;
    phone tries `phone`/`phone_number`/`phoneNumber`/`mobile`), everything
    else copied into `capturedFields` unchanged. `formType` → `sourceDetail`
    via a lookup table for the roadmap's four named form types, falling
    back to `Website / <formType>` for anything else — not a rejection, so
    a form type the website adds later still produces a reasonable label
    instead of failing.
  - `intake.service.ts` (`processWebsiteIntake`): the `(organizationId,
    externalId)` lookup runs first, against the raw body, exactly as D71
    specifies — `websiteEnquiryIntakeSchema.parse()` is never called until
    that lookup finds nothing. **A judgment call beyond D71's literal text**:
    a replay of a previously-`REJECTED` submission re-throws the *same*
    stored error as the same `422`, rather than being treated as a
    not-applicable case — read as a natural extension of "a repeat
    Idempotency-Key must return the original result," applied to every
    outcome the original call could have had, not only a success. Flagged
    here in case a narrower reading was intended. Honeypot hits store
    `SPAM` via a dedicated path that never calls the Lead-creation
    transaction at all. A genuine mapping failure (no email or phone)
    stores `REJECTED` with the Zod/mapping error message. On success: one
    `$transaction` creates the Lead (source "Website", looked up by name
    exactly like `leads.service.ts`'s existing "Manual" lookup) and the
    `WebsiteSubmission` row already as `LEAD_CREATED` with `leadId` set (one
    insert, not create-then-update) and writes the audit row; outside that
    transaction, `findDuplicateLeads({ orgId }, ...)` (no full
    `RequestContext` needed, per the groundwork already laid before this
    session) supplies `possibleDuplicateLeadIds`. **Audit rows for intake
    deliberately bypass the shared `writeAudit()` helper** — that helper
    hard-codes `actorId` to a `RequestContext`'s `userId`, which does not
    exist on this no-human-user path; a small local `writeIntakeAudit()` in
    `intake.service.ts` writes `actorId: null` and
    `metadata: { submissionId, apiKeyPrefix }` directly, for every outcome
    (success, honeypot, and rejection — "intake rejections" is explicitly
    one of the architecture doc's own audited actions, not just successes).
  - `intake.routes.ts`: the one route in this app with no `validate: {
    body }`, with an inline comment explaining why, per D71's instruction
    to flag the deviation in the file itself, not just here.
- **`modules/enquiries/`** (same visibility as Leads — `LEADS_READ` for
  list/detail, `LEADS_WRITE` for mark-spam, `RECORDS_ARCHIVE` for
  archive/restore, identical convention to every other archivable
  resource): list (status/formType/archived/date-range filters, plus `sort`
  — kept for consistency with every other list endpoint even though D71's
  item 10 text didn't name it explicitly, flagged to the user and kept per
  their reply); detail (adds the raw `payload` and a small linked-lead
  summary, list rows never carry `payload`); `mark-spam` (409
  `ALREADY_SPAM` on a second call; archives the linked Lead in the same
  transaction if one exists and isn't already archived — a no-op, not an
  error, if it's already archived); archive/restore (the same
  `ALREADY_ARCHIVED`/`NOT_ARCHIVED` convention every other resource uses).
- **Wired into `app.ts`**: the global `attachApiKeyContext` mount and all
  three new route registrations (`registerApiKeysRoutes`,
  `registerIntakeRoutes`, `registerEnquiriesRoutes`) — built incrementally
  alongside each module for testability, then re-read end to end as a final
  confirmation pass (item 11).
- **Testing, added throughout, not batched to the end**: API-key
  hashing/rotation/revocation including "a revoked/rotated key stops working
  on its very next request" (`tests/middleware/api-key-auth.test.ts`,
  testing `attachApiKeyContext` directly, the same way `csrf.test.ts` tests
  `enforceOriginAndContentType` directly); the CSRF exemption's own unit
  tests; the route-registry allow-list; a full intake suite
  (`tests/intake/`) — happy-path field mapping across all four form types,
  duplicate-email/phone warnings, idempotency (including the required "same
  key, second time with an invalid body, returns the original untouched"
  test, and a replayed-`REJECTED`-stays-`REJECTED` case), honeypot (`SPAM`
  status, no Lead, byte-identical success shape — asserted via an exact key
  set, not just a few fields), validation/rejection (missing
  `Idempotency-Key`, mapping failure, malformed envelope, oversized body),
  the three D71 Origin-exemption scenarios (cookie-no-key → 401,
  no-Origin-valid-key → 201, valid-key-wrong-Content-Type → 415), per-key
  rate limiting (429 on request 61, using requests that fail fast inside the
  handler so the test doesn't need 61 real Lead-creation transactions), and
  cross-organisation isolation; a full enquiries suite covering list
  filters, detail, mark-spam (including the linked-Lead archive and the
  409), archive/restore, Staff-equal-access (these routes aren't
  role-restricted, so this proves Staff isn't *accidentally* blocked,
  mirroring the Admin-only sweep done for api-keys), 404 isolation across
  organisations. `apps/api` test count: 359 (start of this session) → 402
  (after the intake endpoint, item 9's checkpoint) → **409** (after
  enquiries, item 10).
- **Verified (real output, every checkpoint)**: `pnpm typecheck`/`pnpm lint`
  clean across the whole repo at every stage, 0 errors throughout (the same
  3 pre-existing React Compiler warnings in files this work never touched).
  Final full-repo `pnpm test`: **apps/api 409/409, apps/web 91/91.**

## D73 — Day 5a frontend: the API Keys and Enquiries screens (2026-11-24)

- **`/settings/api-keys`** (the first route under `/settings` in this app —
  `apps/web/app/(protected)/settings/api-keys/`), Admin-gated the same way
  `/users` already is: a client-side redirect to `/forbidden` for Staff
  (the real control is the API's own `settings:manage` permission check;
  this is only so Staff don't see a broken page if they land here directly),
  plus a new nav item in `app-shell.tsx` gated on `isAdmin`, placed right
  after Users.
  - **Create and rotate both need a "shown exactly once" raw key reveal,
    not just a toast or a plain confirm** — `CreateApiKeyDialog` is a single
    `Dialog` with two internal steps (the name form, then — on success,
    without closing — the raw key in a read-only, auto-selecting input with
    a copy button and an explicit warning that it won't be shown again).
    `RotateApiKeyDialog` needed its own component, not a reuse of the
    existing `ConfirmActionDialog`, for the same reason: rotating also
    returns a brand-new raw key that needs the identical reveal treatment,
    which a plain confirm-dialog has no way to show.
  - Revoke reuses `ConfirmActionDialog` unchanged (a true one-action-behind-
    one-confirmation case, like every archive/deactivate action already in
    this app).
  - The list table shows `keyPrefix` (never a hash, never the raw key after
    the reveal closes), an Active/Revoked badge, `lastUsedAt`, and
    `createdAt` — no search or filtering, since D71's plan didn't ask for
    any and the roadmap's own API-key feature (Day 5, package 5.1) has no UI
    at all in the original brief, only a CLI script; this session's earlier
    decision to build an Admin-only in-app screen instead (the Day 5a plan
    recorded in D71) is the entire reason one exists.
- **`/enquiries`** (`apps/web/app/(protected)/enquiries/`), visible to both
  roles — a new nav item placed next to Deals, no role gating at all (the
  API itself has none for these routes either; see D72).
  - List: the shared `DataTable` component (the same one Leads/Companies/
    Contacts/Deals already use), URL-synced filters via the existing
    `useListUrlState` hook (status, form type as a free-text filter — there
    is no fixed form-type list to build a `Select` from, since the real
    website's form types are only known from the roadmap's documentation,
    not confirmed against real code — received-date range, archived
    toggle), sortable columns, a direct link to the linked Lead when one
    exists.
  - Detail: the shared `RecordLayout` component (the same key-fields-strip-
    plus-tabs shell Companies/Contacts/Leads/Deals already use) — an
    Overview tab (external id, submission id, any stored error, and the
    linked Lead's own key fields inline) and a Raw Payload tab (the stored
    JSON, pretty-printed in a `<pre>` block — deliberately the simplest
    possible viewer; nothing in D71's plan asked for syntax highlighting or
    a collapsible tree, and adding one would be scope beyond what was
    asked). Mark-spam, archive, and restore are all `ConfirmActionDialog`
    reuses, same pattern as every other archivable resource's detail page.
  - `lib/enquiry-presentation.ts`: a new status-label/badge-variant mapping
    file, mirroring `lib/lead-presentation.ts`'s existing tone logic exactly
    (a successful outcome is "success"/green, a failed one "danger"/red,
    spam "warning"/amber).
- **No new component tests added for either screen** — matching this
  project's own established, deliberate scope choice for Companies/
  Contacts/Leads' list and detail page clients in Day 2 (manual coverage
  instead; see `docs/PROJECT-STATE.md`'s open-items list), not an oversight
  specific to this session.
- **Manual verification is limited, and this is stated plainly rather than
  implied otherwise**: this environment has no browser-automation tool (see
  `docs/NEXT-SESSION-START.md`'s "Open items"), so neither screen has
  actually been clicked through. What *was* checked: both dev servers were
  started, `/enquiries`, `/settings/api-keys`, `/`, and `/login` all
  returned `200` through the Next.js proxy (no server-side crash in the new
  routes), and `GET /api/v1/enquiries`/`GET /api/v1/api-keys` both correctly
  returned `401` unauthenticated through that same proxy, confirming the new
  API routes are reachable end to end — then both servers were shut down
  cleanly by exact PID, with ports 3000/4000 confirmed clear afterward.
  Actually using either screen (dialogs, copy-to-clipboard, filters, the
  payload viewer, both themes) is unverified and needs the user.
- **Docs for this whole feature**: `docs/intake-contract.md` (new — the full
  written contract: headers, body shape, the field-mapping table, response
  table, idempotency and honeypot behaviour) and
  `apps/api/scripts/replay-intake.sh` (new — a small, human-run `curl`
  script walking through a success, a replay-with-an-invalid-body, a
  honeypot hit, and a rejection, against a local API only; per the original
  brief's ask for "a documented curl example and a small test script"
  instead of touching the real website). The script's syntax was checked
  (`bash -n`) and its four scenarios mirror cases the automated intake suite
  already exercises line-for-line; it was not run live against a real
  server and a real key, to avoid creating persistent demo data in the
  shared local `crm_dev` database without asking first — the user can run
  it themselves against their own key.

## D74 — Day 5a audit follow-up: closing two real test-coverage gaps the user found by asking for proof, item by item (2026-11-24)

After D72/D73's report, the user asked for a plain, per-refinement
accounting of D71's eight binding items: DONE-and-proven, or
documented-only. That audit (done by actually grepping the test files, not
from memory) found two genuine gaps — implemented correctly, but never
independently verified by a test — and two items that were already fully
proven. The user then asked for small tests closing the two real gaps, plus
one item (per-IP rate limiting) that needed a new testable seam to prove at
all without 120+ real requests. This entry records what was added; D72/D73
are left as written, as the accurate checkpoint reports they were at the
time, rather than edited retroactively.

- **Gap 1 — the key-hashing/comparison mechanism itself had no dedicated
  unit test**, only end-to-end proof via the real middleware (right key
  works, wrong key doesn't). New `tests/lib/api-key.test.ts`: `generateApiKey`
  (correct literal prefix, a `keyPrefix` that is itself a prefix of the full
  key and longer than the bare literal prefix, a consistent key length, 50
  consecutive calls all distinct); `hashApiKey` (deterministic, different
  keys hash differently, never equals the raw key, a 64-character lowercase
  hex SHA-256 digest); `verifyApiKeyHash` (`true` for a matching pair,
  `false` for a mismatched same-length pair, and — the specific case this
  function exists to guard, per its own doc comment about
  `crypto.timingSafeEqual` throwing on mismatched buffer lengths — `false`
  without throwing for differently-sized input in both directions).
- **Gap 2 — nothing read back a real `auditEvent` row to confirm D71's
  logging/audit-minimisation promise, and the new `Idempotency-Key` redact
  path had no test either** (consistent with the pre-existing
  `authorization` redact line, which also had none — but the user asked for
  it tested here regardless). New `tests/intake/audit.test.ts`: after a
  successful intake, a honeypot hit, and a rejection, reads back the real
  `auditEvent` row for that submission and asserts `actorId` is `null`,
  `metadata` deep-equals exactly `{ submissionId, apiKeyPrefix }` (not just
  "contains" — `toEqual`, so an accidental extra field would fail this too),
  and that the raw key, the `Idempotency-Key` value, and the submitted
  name/email/phone/message appear nowhere in the serialised row, for all
  three outcomes. **`logger.ts` refactored**: the redact path array is now
  a named export, `LOG_REDACT_PATHS`, used by the real `pino()` call instead
  of an inline literal — the single source of truth needed so a test could
  both assert on the exact path list *and* feed that exact config into a
  throwaway `pino` instance writing to a capturable stream, proving the
  `Idempotency-Key` and `Authorization` headers are actually censored (not
  just named in a list somewhere), while an unrelated field passes through
  untouched — new `tests/logger.test.ts`.
- **Per-IP rate limiting — the mechanism itself had no test at all**
  (only the per-key limiter did, via 61 real requests, which is cheap since
  they fail before touching the database). Hitting the real 120/minute
  per-IP ceiling the same way would need 121 real requests per test run;
  instead, `lib/rate-limit.ts`'s per-IP limiter was refactored from a fixed
  singleton into `createIntakeIpRateLimiter(ceiling, windowMs?)`, the exact
  same ceiling-parameterised-factory pattern this file's own
  `createGlobalLoginFloodLimiter` already established for the login flood
  limiter — the production singleton is just that factory called once with
  the real 120 ceiling. New test in `tests/intake/auth-and-rate-limit.test.ts`
  (`describe('intake per-IP rate limiting (isolated, low-ceiling)')`)
  proves the mechanism trips at a low test ceiling (3). **Said as plainly in
  the test's own comment as here**: this proves the rate-limiting *code*
  works as written. It does not and cannot prove that `req.ip` is a genuine,
  distinct value per real-world caller once this runs on Render —
  `TRUST_PROXY` stays `false` (D60, untouched), and nothing in a local test
  process can simulate Render's actual edge/load-balancer network path. That
  remains reasoning only (D60/D71/D72), exactly as already documented, now
  with an explicit note that the new test doesn't change that.
- **The one item that is, honestly, reasoning-only by design and needs no
  test**: the spam/rejected-rows retention note (D71) is a recorded decision
  *not* to build a retention policy — there is no behaviour to assert on.
- **`docs/DAY-5A-SUMMARY.md` gained an explicit "What is tested vs.
  reasoning only" table**, one row per one of D71's eight refinements,
  naming the exact test file (or stating plainly that an item is
  documentation-only) — so a future reader never has to reconstruct this
  from `decisions.md`'s prose.
- **Testing**: 18 new tests (11 in `tests/lib/api-key.test.ts`, 3 in
  `tests/intake/audit.test.ts`, 3 in `tests/logger.test.ts`, 1 in
  `tests/intake/auth-and-rate-limit.test.ts`'s new per-IP describe block).
  `pnpm typecheck`/`pnpm lint` clean across the whole repo (same 3
  pre-existing `apps/web` warnings, 0 errors). Full repo `pnpm test`:
  **apps/api 427/427 (up from 409), apps/web 91/91 — 518 total.** No
  schema, migration, permission, or dependency change.

## D75 — Bug fix, found in manual testing: Rotate on the API Keys screen never showed the new raw key (2026-11-24)

The user found this by actually clicking through the app: creating a key
correctly showed the "shown once" reveal view, but rotating one revoked the
old key and created the new one (both visible in the list, and in the
database) without ever showing the new raw key to copy — silently locking
the integration out of ever seeing it.

- **Root cause**: `RotateApiKeyDialog` is only rendered for a row whose
  `apiKey.revokedAt` is falsy (`ApiKeysPageClient`'s
  `{!apiKey.revokedAt && (<RotateApiKeyDialog .../>...)}`). The original
  `handleRotate` called `queryClient.invalidateQueries(...)` to refresh the
  list **immediately** on a successful rotation, *before* `setNewKey(...)`.
  That refetch resolves almost instantly; the resulting re-render shows the
  just-rotated-out old key's row as revoked, so the `!apiKey.revokedAt`
  guard goes false and React **unmounts** `RotateApiKeyDialog` — destroying
  its `open`/`newKey` state and tearing the open dialog out of the DOM —
  right as, or just after, it should have shown the reveal view.
  `CreateApiKeyDialog` never had this problem: it is rendered
  unconditionally at the top of the page, never gated on any row's data, so
  the same immediate-invalidate-on-success never unmounts it.
- **Fix**: in both dialogs, the list is now invalidated only when the
  dialog actually **closes** (inside `onOpenChange(false)`, and only if a
  key was in fact created/rotated — i.e., `newKey`/`createdKey` is set),
  never the instant the mutation succeeds. The reveal view is shown first,
  on its own, with nothing refetching underneath it; only once the user
  clicks Done (or dismisses the dialog any other way — Radix routes every
  close path through the same `onOpenChange`) does the list refresh and the
  now-revoked old row disappear from the active set. `CreateApiKeyDialog`
  got the identical treatment even though it was never actually broken —
  same reveal-once dialog class, kept symmetric so neither can regress into
  this bug if either component's rendering context ever changes (e.g. if a
  future refactor moved the Create button inside a conditionally-rendered
  wrapper the way Rotate always was).
- **Verified as a real regression, not assumed**: before restoring the fix,
  the new frontend test (below) was run against the reverted, original
  buggy code and failed exactly as reported — the reveal view disappeared
  and the row showed "Revoked" instead. The fix was then restored and the
  same test passed. This is recorded here because it is read-only safety
  practice for a bug-fix session, not boilerplate: a test that cannot be
  shown to fail against the bug it claims to guard is not trustworthy.
- **Testing**:
  - Backend (`tests/api-keys/crud.test.ts`, new test): confirms the rotate
    response carries the raw key exactly once in the whole JSON payload
    (counted via a literal substring search, not just presence), and that
    neither the just-rotated-out old row nor the new row ever carries `key`
    or `keyHash` in a subsequent list fetch — the invariant the whole
    frontend fix depends on holding.
  - Frontend (`tests/components/api-keys-page-client.test.tsx`, new file):
    renders the real `ApiKeysPageClient` (not `RotateApiKeyDialog` in
    isolation — the bug was about the *parent's* conditional rendering, so
    an isolated component test could never have caught it), stubs
    `fetch` to serve a changing list (one active key, then that key revoked
    plus a new one, mirroring what a real refetch would return), clicks
    through Rotate → confirm → asserts the reveal view appears with the
    exact new key value, asserts it is **still** showing after a short
    delay (long enough for a wrongly-immediate refetch to have resolved and
    re-rendered, if the bug were still present), then clicks Done and
    confirms the list *then* refreshes to show the old row as Revoked.
  - `pnpm typecheck`/`pnpm lint` clean across the whole repo (same 3
    pre-existing `apps/web` warnings, 0 errors). Full repo `pnpm test`:
    **apps/api 428/428 (up from 427), apps/web 92/92 (up from 91) — 520
    total.** No schema, migration, permission, or dependency change.
    `docs/MANUAL-TEST-DAY5A.md` needed no edit — its rotate step already
    described the correct (now actually working) behaviour; only the code
    was wrong, not the script.

## D76 — Day 5 part (b) kickoff and CSV export: Leads, Companies, Contacts, Deals (2026-11-24)

Day 5b's approved scope: CSV export, a Docker "full" profile, a README
rewrite, an RBAC sweep, and a P0-vs-PRD freeze list — see
`docs/DAY-5B-SUMMARY.md` for the full plain-language account of the whole
session, including two real incidents found while building the Docker piece
(D77–D80 below). This entry covers CSV export only.

- **Scope confirmed with the user before building**: Leads, Companies,
  Contacts, and Deals get an export; Enquiries does not — the roadmap's own
  P0 text only ever named Leads and Deals, and Enquiries has no export
  requirement anywhere in the PRD or the 5-day plan. The user chose this
  explicitly when asked.
- **`apps/api/src/lib/csv.ts`** (new): `csvCell()` is the one function that
  decides a cell's final text — stringify, then neutralise formula
  injection, then RFC4180-quote, in that order. Formula-injection defence:
  a cell whose first character is `=`, `+`, `-`, `@`, a tab, or a carriage
  return gets a leading single quote, which Excel/Sheets/LibreOffice all
  treat as "force to plain text." RFC4180 quoting: a cell containing a
  comma, a double quote, or a line break is wrapped in double quotes with
  internal quotes doubled. `CSV_EXPORT_ROW_LIMIT = 10_000`, matching the
  5-day roadmap's own stated cap. 21 new tests
  (`tests/lib/csv.test.ts`), including the specific case where both
  defences must apply to the same cell in the right order.
- **Each of the four services** (`leads.service.ts`, `companies.service.ts`,
  `contacts.service.ts`, `deals.service.ts`) had its `listX`'s inline
  `where` object extracted into a private `buildXWhere(ctx, query)`
  function, reused by both the existing `listX` and a new `exportX(ctx,
  query)` — so an export can never drift out of sync with its list
  endpoint's filters, per CLAUDE.md's "reuse shared helpers" rule, and
  because the roadmap's "export respects the current filters" rule is only
  actually true if they share one implementation. `exportX` takes the same
  filters and sort as `listX`, ignores `page`/`pageSize`, and caps at
  `CSV_EXPORT_ROW_LIMIT` via a plain `take`. Each export query includes a
  small join for display names that the JSON list responses don't carry
  (owner name, lead-source name, company name, pipeline-stage name) —
  needed only because a downloaded CSV has no client-side app left to
  resolve an id to a name the way the browser UI already does.
- **New routes**, all gated on the existing, previously-unused
  `PERMISSIONS.REPORTS_EXPORT` (defined in `packages/shared` since Day 1 but
  never attached to a route before now — built, on reflection, for exactly
  this): `GET /api/v1/leads/export`, `/companies/export`, `/contacts/export`,
  `/deals/export`. `REPORTS_EXPORT` is not Admin-only, matching the PRD's
  "Staff: yes" for reports. Each is registered before its resource's `/:id`
  route, same reason `/leads/duplicates` already was (Express matches by
  registration order; `export` would otherwise be captured as an `:id`).
  Response: `text/csv; charset=utf-8`, `Content-Disposition: attachment;
  filename="<resource>-export-<date>.csv"`.
- **Frontend**: a small shared `buildExportHref(path, params)` helper
  (`apps/web/lib/export.ts`, 5 unit tests) builds the export URL from the
  exact same filter values each page already passes to its list query —
  not from `searchParams.toString()` directly, since a few filters (dates,
  `sort`) are normalised before being sent to the list hook and the export
  link must send the same normalised form. A plain `<a href>` "Download
  CSV" button (not a fetch+blob dance) was added to the Leads, Companies,
  Contacts, and Deals list pages, right next to each page's existing
  primary action — same-origin GET through the already-existing `/api/*`
  rewrite proxy, so the browser's native download handling and the
  session cookie both just work with no extra code.
- **Testing**: 19 new backend route tests across 4 new files
  (`tests/{leads,companies,contacts,deals}/export.test.ts`) — Admin and
  Staff can both export; unauthenticated is refused; the same filters the
  list endpoint accepts are respected; a formula-injection attempt in a
  real field is neutralised end to end; cross-organisation isolation holds.
  `pnpm typecheck`/`pnpm lint` clean throughout (0 errors, the same 3
  pre-existing `apps/web` warnings). Full repo test count after this entry:
  **apps/api 449/449 (up from 428), apps/web 97/97 (up from 92) — 546
  total** (before D77's rate-limit/connection-timeout additions, which add
  a further few tests — see D77/D78).

## D77 — Docker "full" profile: Dockerfiles, docker-compose, and two real bugs found by actually running it (2026-11-24)

The roadmap asks for Dockerfiles for both apps and a Compose `full` profile
that runs the whole stack in one command. Built, then verified by actually
building and running it end to end (not just trusting the design) — which
surfaced two genuine, pre-existing bugs unrelated to Docker itself, described
below, both fixed with a test. D78–D80 cover three further incidents found
during that same verification, each significant enough for its own entry.

- **Both Dockerfiles are deliberately single-stage**, not a minimal
  multi-stage/`pnpm deploy` build: the whole monorepo is installed and built
  inside the image, and the final container keeps the full workspace and
  devDependencies on disk. A conscious simplicity-over-image-size tradeoff
  for a local/demo "run the whole stack in one command," not a
  production-minimised image — revisit only if this is ever used for
  something other than a local demo.
- **Everything is copied into the image before `pnpm install`, not split
  into a cached dependency-only layer first** — found necessary by actually
  running the build: the root `package.json`'s own `"prepare"` script
  (`pnpm --filter @growspark/shared build && prisma generate`) runs
  automatically as part of `pnpm install` itself (an npm/pnpm lifecycle
  hook), and needs the real source of `packages/shared` and
  `apps/api/prisma` already present to succeed. The cost: this design has
  very little Docker layer-caching benefit — almost any file changing
  anywhere in the repo invalidates the `COPY . .` layer and forces a full
  `pnpm install` from scratch on the next build. Accepted for a one-build,
  many-runs local demo image; not revisited under this session's time
  budget.
- **`node:22.20.0-bookworm-slim` (Debian), not an Alpine base** — needs
  `apt-get install openssl` explicitly (Prisma's own engine postinstall
  prints a warning naming this exact fix when it can't detect a libssl
  version, which is exactly what happened the first time this was built
  without it) but avoids Alpine/musl's own well-known Prisma engine-binary
  quirks entirely.
- **A placeholder, build-time-only `DATABASE_URL`** (`ENV
  DATABASE_URL=postgresql://build:build@localhost:5432/build_placeholder`)
  is set in both Dockerfiles before `pnpm install`. Needed because the
  `"prepare"` script's `prisma generate` step requires `DATABASE_URL` to
  resolve to *some* syntactically valid connection string — Prisma 7's
  config loader (`prisma.config.ts`) throws `PrismaConfigEnvError`
  otherwise, even though `generate` never actually opens a connection, only
  reads `schema.prisma`. The real runtime value (`crm_docker`, D78) is set
  by `docker-compose.yml`'s `environment:` and always overrides this
  placeholder once the container actually starts. This also applies to
  `apps/web/Dockerfile`, even though that image never touches Prisma
  itself: a root-level `pnpm install` installs every workspace member's
  dependencies, including `apps/api`'s, so the same lifecycle script runs
  there too.
- **Bug found #1 — `express-rate-limit` v8's IPv6 validation, tripped for
  real only once this ran outside `vitest` for the first time.** The
  per-IP intake rate limiter's `keyGenerator` used `req.ip` directly; v8
  validates this at construction time and printed `ERR_ERL_KEY_GEN_IPV6` on
  every container start (non-fatal — the server still started — but a real,
  previously invisible issue: `NODE_ENV=test` makes the logger silent,
  D22, so this had never been seen printed before). The real concern
  isn't cosmetic: an un-normalised IPv6 key lets one caller rotate through
  billions of distinct `req.ip` values from a single `/64` allocation,
  defeating a per-IP limiter entirely. **Fixed**: `ipKeyGenerator(req.ip)`
  (the library's own exported helper, which normalises to a `/56` subnet)
  instead of `req.ip` directly, in
  `apps/api/src/lib/rate-limit.ts`. Verified against the existing
  `tests/intake/auth-and-rate-limit.test.ts` suite, unchanged and still
  green (loopback addresses are unaffected by the fix, per
  `ipKeyGenerator`'s own IPv4-mapped-address handling).
- **Bug found #2 — an unbounded database-connection timeout.** The very
  first time a fresh container's long-running server process made its
  first real database query (`GET /health/db`, via the raw `pg.Pool`
  `db/prisma.ts` exports — the same pool backs every Prisma query in the
  app, not just this one route), it took **over ten minutes** to respond, a
  genuine wall-clock measurement, not a guess (`time curl`, repeated to
  confirm, then instant — 0.12s — on every call after the first). Root
  cause: `pg.Pool`'s own default `connectionTimeoutMillis` is `0` — wait
  forever — so a one-time, apparently transient connection stall (Docker
  Desktop/WSL2 networking, never conclusively identified beyond "DNS
  resolution itself was fast, ruled out by direct testing inside the
  container") turned into an unbounded hang instead of a fast, retryable
  failure. **This is not Docker-specific** — the exact same unbounded wait
  could happen against Supabase in staging under a transient network blip.
  **Fixed**: `buildDatabasePoolConfig`
  (`apps/api/src/lib/database-ssl.ts`) now always sets
  `connectionTimeoutMillis: 10_000` (10 seconds). A stalled connection now
  fails fast and the next request's `pg.Pool` simply tries again, rather
  than every request hanging indefinitely. New test in
  `tests/lib/database-ssl.test.ts` asserts this is always set and is
  `> 0`; the existing exact-equality test for the local-dev case was
  updated to include it.
- **Verified end to end, repeatedly, including after every fix below**:
  real container builds, real `docker compose --profile full up`, curl
  against real endpoints, a real login, real CSV export through the full
  proxy chain. Not just a design read through — see `docs/DAY-5B-SUMMARY.md`
  for the full account of what was actually run and observed.
- **Testing**: 1 new test in `tests/lib/database-config-guards.test.ts`
  (D78 below, for the `postgres` hostname), 1 new assertion group in
  `tests/lib/database-ssl.test.ts`. `pnpm typecheck`/`pnpm lint` clean.

## D78 — Incident: a Docker test run overwrote the real local Admin/Staff passwords in `crm_dev`; fixed with a dedicated `crm_docker` database (2026-11-24)

**What happened, plainly.** While verifying the Docker "full" profile for
the first time, the api container's `DATABASE_URL` pointed at `crm_dev` —
the *same* database and the *same* Postgres container native `pnpm dev`
already uses (same `docker-compose.yml` service, same volume). To prove a
real login worked, `pnpm db:seed` was run inside the container with
throwaway passwords. The seed **upserts** `admin@growspark.test` /
`staff@growspark.test` by email (D15) — so this overwrote the real,
already-set password hashes for both demo accounts in the user's own local
database. The user caught this from the report, confirmed they had
re-run their own `pnpm db:seed` locally to restore their real passwords,
and then set three firm rules for the rest of this session: the Docker
profile must use its own database with no way to ever touch `crm_dev`
again, a cold reviewer must get a working login with no manual step, and
this tool must never run `db:seed` or any other write against `crm_dev`
again without asking first.

- **Fix — a database of its own, not just a different config value that
  could drift back.** `docker/init-db.sh` now also creates `crm_docker`
  (alongside the existing `crm_test`) on any brand-new Postgres volume;
  the user's own already-initialised volume got the same database created
  by hand, once, the same way the init script would have (`CREATE DATABASE
  crm_docker OWNER growspark_dev` — additive only, confirmed `crm_dev`
  unaffected both before and after). `docker-compose.yml`'s `api` service
  now hardcodes `.../postgres:5432/crm_docker` — deliberately **not**
  `${POSTGRES_DB:-crm_dev}` interpolated from the same variable the
  `postgres` service itself uses, specifically so the full profile can
  never be pointed at `crm_dev` again just by an environment default
  changing.
- **`checkLocalDatabaseHost()`
  (`apps/api/src/lib/database-config-guards.ts`) needed widening first**:
  it only accepted `localhost`/`127.0.0.1`/`::1`, and would have refused to
  start against a hostname like `postgres` (the Compose service name the
  api container must use to reach the same Postgres container over the
  Docker network). Added `'postgres'` to its allowed set, with a comment
  explaining it is this repo's own fixed Compose service name, not a real
  remote host — the guard's actual purpose (never silently run against a
  real remote database) is unchanged. New test in
  `tests/lib/database-config-guards.test.ts`.
- **A cold reviewer gets a working login automatically, with fixed,
  documented, non-secret demo credentials** — `admin@growspark.test` /
  `staff@growspark.test`, password `dev-only-admin-password` /
  `dev-only-staff-password` (the same placeholder strings
  `apps/api/.env.example` already uses, reused on purpose so nothing new
  needs to be remembered). `apps/api/Dockerfile`'s `CMD` now runs `pnpm
  exec prisma migrate deploy && pnpm db:seed && node dist/index.js` — the
  seed step is new, and safe specifically because it can now only ever
  target `crm_docker`, a throwaway sandbox database nobody else uses,
  re-seeded idempotently (upsert, D15) on every container start.
  `APP_ENV: local` was also added to the api service's environment, so the
  optional, documented follow-up `docker compose --profile full exec api
  pnpm db:seed:sample` (richer fictional demo data) works without needing
  `--confirm` (`apps/api/src/lib/sample-seed-guard.ts`) — not run
  automatically, since the user asked only for a working login, not for
  richer data, and auto-running it would have been scope beyond what was
  asked.
- **Verified, carefully, after the fact**: a fresh container's first
  connection applies both migrations and seeds exactly 2 users into
  `crm_docker`; `crm_dev` was independently confirmed unchanged (row counts
  and the real admin/staff accounts' roles identical before and after) at
  every stage of this session from this point on, including at the very
  end (D80).
- **Standing rule for every future session, not just this one**: this tool
  must never run `pnpm db:seed`, `db:seed:sample`, or any other write
  against `crm_dev` without asking the user first, regardless of context —
  recorded here because it is a durable constraint, not a one-time
  apology.

## D79 — Incident: real `.env`/`.env.staging.local` files leaked into the built Docker images via a `.dockerignore` pattern that doesn't mean what it looks like it means (2026-11-24)

**What happened.** While investigating why a rebuilt container still
seemed to show `crm_dev`-looking data (itself later found to be a separate
port-collision issue, D80 — this incident was real regardless), a direct
`ls` inside the running api container found `apps/api/.env` **and
`apps/api/.env.staging.local`** — real local database credentials and real
staging/Supabase credentials — both present inside the built image.

- **Root cause**: `.dockerignore`'s `.env`/`.env.*` lines were bare
  patterns, written the same way `.gitignore`'s equivalent lines are. In
  `.gitignore`, a bare pattern with no slash matches at every directory
  depth. **`.dockerignore` does not work the same way** — Docker's ignore
  matcher (moby/patternmatcher) only matches a bare pattern at the context
  root; matching at any depth needs an explicit `**/` prefix. So `.env`
  excluded a root-level `./.env` (which doesn't even exist in this repo —
  env files live inside each app's folder) while doing nothing at all for
  `apps/api/.env`, `apps/api/.env.staging.local`, or `apps/web/.env`. This
  was found by actually inspecting a running container's filesystem, not
  by reading the `.dockerignore` file and assuming the gitignore-style
  pattern worked the same way here — and that distinction matters: reading
  the file and reasoning about it would have reached the same wrong
  conclusion the original author did.
- **Fix**: every pattern in `.dockerignore` now has both the bare and a
  `**/`-prefixed form (and the negations — `!.env.example` /
  `!**/.env.example` — the same way), so a secret file is excluded
  regardless of depth.
- **A second, related fix was needed to make the corrected `.dockerignore`
  actually buildable**: once real `.env` files were genuinely excluded,
  the build broke in a *different* way — `prisma generate` (triggered by
  the `"prepare"` lifecycle script, D77) needs `DATABASE_URL` to resolve to
  *something*, and previously it had been accidentally "working" only
  because the leaked real `.env` supplied one. Fixed with the placeholder
  `ENV DATABASE_URL=...` described in D77 — a second, independent fix, not
  a reversion of this one.
- **Clean-up performed on this machine, this session, with the user's
  explicit instruction**: both existing `growspark-sales-crm-api`/`-web`
  images were deleted (`docker rmi`, after stopping/removing the
  containers using them) and the *entire* Docker BuildKit cache was pruned
  (`docker builder prune -a -f`, confirmed `0B` reclaimable afterward) —
  not just the two image tags, since an overwritten tag's old layers can
  otherwise persist in the build cache or as untagged/dangling image data.
  Verified every unrelated image on the machine (13 Supabase images used by
  the user's own other project, `postgres:17-alpine`, `hello-world`) was
  untouched by checking before and after. Both images were then rebuilt
  clean and directly inspected (`ls -la /app/apps/*/.env*`) to confirm only
  `*.example` files are present.
- **Confirmed nothing was ever pushed anywhere.** Every Docker command run
  this session was `build`/`up`/`exec`/`logs`/`ps`/`rm`/`rmi`/`stop` against
  purely local image names with no registry host prefix — never `docker
  push`, `docker login`, or a `docker tag` naming a remote registry. The
  exposure, for the time it existed, was local-disk-only on this machine.
- **A permanent guard, not just a one-time fix**: `scripts/check-dockerignore.mjs`
  (new) asks the real Docker build to apply the real `.dockerignore`
  against a tiny throwaway `busybox` image, then inspects *that built
  image's actual filesystem* for any `.env`-style file that isn't a
  `.example`, printing and failing on anything it finds. Deliberately does
  **not** re-implement `.dockerignore` pattern matching in a script —
  exactly that kind of reimplementation is what produced this bug in the
  first place; asking Docker's own real build to apply the real file
  cannot repeat the same mistake. Wired up as `pnpm
  docker:check-env-leak`. **Proven to actually catch the original bug**,
  not just shown to pass now: run against a restored copy of the original,
  broken `.dockerignore`, it correctly fails and names all three leaked
  files; restoring the fixed version and re-running passes — the same
  "prove it fails against the bug it claims to guard" discipline D75
  already established for this project.
- **Security lesson, recorded plainly because the user asked for it to
  be**: `.dockerignore` is not `.gitignore` with a different filename, even
  though the syntax looks nearly identical — a bare pattern's matching
  depth is different between the two, and that difference leaked real
  secrets into a build artifact on the very first attempt. Any future
  `.dockerignore` change should either use `check-dockerignore.mjs` to
  verify it, or at minimum use explicit `**/` prefixes rather than trusting
  gitignore intuition.

## D80 — Incident: the Docker profile's host ports collided with native `pnpm dev`, causing Windows to silently serve native-dev traffic instead of the container's; fixed by moving to dedicated ports (2026-11-24)

**What happened.** After D78's fix, a careful, repeated re-test still
seemed to show `crm_dev` data through `http://localhost:3000`/`:4000` no
matter how many times the containers were rebuilt or recreated — directly
inspecting the running container (`docker exec ... node -e "fetch(...)"`,
bypassing the host port entirely) proved the container itself was correctly
isolated and had zero leads in `crm_docker` the whole time. The actual
cause: the user's own native `pnpm dev` (confirmed by inspecting the real
process command lines via `Get-CimInstance Win32_Process`) was *also*
running, bound to `0.0.0.0:3000`/`0.0.0.0:4000`, at the same time Docker had
its own `127.0.0.1:3000`/`127.0.0.1:4000` port mappings active. Windows
allowed both binds to coexist rather than erroring, and routed `curl
http://localhost:...` to the native (`0.0.0.0`-bound) process every time —
silently serving the wrong server instead of failing loudly, which is what
made this so easy to misdiagnose as a data-isolation bug when it never was
one.

- **Fix — different host ports, not a port-sharing convention to remember
  and get right every time.** `docker-compose.yml`'s `api`/`web` services
  now publish on **4100**/**3100** by default (`DOCKER_API_PORT`/
  `DOCKER_WEB_PORT`, both overridable), never 4000/3000 — so the Docker
  profile and native `pnpm dev` can run at the same time with no ambiguity
  at all, by construction, rather than by a documented rule someone has to
  remember. Container-*internal* ports are unchanged (the api process still
  listens on 4000 inside its own container, the web process on 3000 inside
  its own) — only the host-side published ports moved; nothing inside
  either container needed to change for this.
- **`ALLOWED_ORIGINS` updated to match** (`http://localhost:${DOCKER_WEB_PORT:-3100}`)
  — the browser's `Origin` header includes the port, and the CSRF check
  (`enforceOriginAndContentType`) requires an exact match; leaving this at
  `:3000` while the browser actually loads `:3100` would have made every
  write silently 403.
- **A second, independent bug found while re-verifying on the new
  ports**: the web container's rewrite proxy failed with `ECONNREFUSED
  127.0.0.1:4000` (then, after the api container was also recreated,
  `ECONNREFUSED <container-ip>:4000`) even though `docker exec ... printenv
  API_INTERNAL_URL` on the running container correctly showed
  `http://api:4000`, and the two containers could reach each other
  directly (confirmed with a raw `fetch()` from inside the web container).
  **Root cause**: `next.config.ts`'s `rewrites()` reads
  `process.env.API_INTERNAL_URL` once, and Next's *production build*
  (`next build`, run inside the Dockerfile) serialises the resulting
  destination into the build output — setting the correct value as a
  container environment variable *afterward*, at `docker run`/`docker
  compose up` time, has no effect on an already-built `.next`, because
  Docker Compose's `environment:` only ever applies once a container
  starts, never during the earlier `docker build`. The container had
  genuinely been running with the correct runtime env var the whole time;
  it just didn't matter, because the thing that needed the value had
  already run and frozen its answer before that env var could ever exist.
  **Fixed**: `apps/web/Dockerfile` now sets `ENV
  API_INTERNAL_URL=http://api:4000` **before** `RUN pnpm --filter web
  build` — always this exact value for this compose setup (the Compose
  service name and the api container's own internal port, neither of which
  `DOCKER_API_PORT` — the *host*-published port — ever changes).
- **Final verification, after both fixes, on the real new ports**: a real
  login via `http://localhost:3100` against the actual rebuilt containers;
  `GET /api/v1/leads` through the full proxy chain returns an empty array
  (genuinely fresh `crm_docker`, not `crm_dev`'s real data); a CSV export
  request succeeds through the same proxy chain; an unauthenticated request
  still gets a real `401`; `crm_dev`'s row counts and the real
  admin/staff users' roles were re-checked directly and are unchanged.
  Containers were stopped and removed afterward (`docker compose --profile
  full stop/rm`), leaving only the pre-existing, untouched `postgres`
  service running, exactly as it was before any of this session's Docker
  work began.
- **Full regression after all of D76–D80's fixes**: `pnpm
  typecheck`/`pnpm lint` clean across the whole repo (0 errors, the same 3
  pre-existing `apps/web` warnings). **apps/api 470/470, apps/web 97/97 —
  567 total.** (Two failures seen in one intermediate run were reproduced
  as resource contention from running heavy `docker exec`/`psql` commands
  concurrently with the test suite against the same shared Postgres
  container `crm_test` lives in — re-running the suite alone, with Docker
  idle, passed cleanly; not a real regression, not left unresolved.)

## D81 — The audit log Admin page: closing D76–D80's one reported gap (2026-11-24)

The user chose to build this now rather than accept the gap. The backend
route (`GET /audit-events`, filters, pagination, newest-first ordering)
already existed and needed no changes beyond the metadata safeguard below;
this entry covers the new frontend page and that safeguard.

- **Metadata is allowlisted at the response layer, not trusted as
  written.** Every real `writeAudit()`/`writeIntakeAudit()` call site in
  the codebase was read (not sampled) to build the list — every one
  already writes only names, ids, enum values, or arrays of *field names*
  (e.g. `changedFields`), never a password, a raw API key, or a full
  enquiry payload. Rather than trust that this stays true forever,
  `apps/api/src/lib/audit-metadata.ts`'s `sanitizeAuditMetadata()` is an
  **allowlist** (not a denylist) of exactly those known-safe key names,
  applied in `audit.service.ts`'s `toAuditEventResponse` before any
  metadata reaches the API response. An allowlist, deliberately, not a
  denylist: a denylist lets a brand-new field through by default the
  moment a future call site adds one and nobody remembers to list it as
  dangerous; this allowlist hides anything unrecognised by default
  instead, which is the direction a mistake should fail in for an
  Admin-only audit screen. Proven with a real end-to-end test
  (`tests/audit/list.test.ts`): a row is inserted directly with
  deliberately dangerous key names (`rawKey`, `password`, `passwordHash`,
  `token`, `sessionToken`, `secret`) and real-looking values, and the test
  asserts the full JSON response never contains any of those keys or
  values — not just that the known-safe fields are present.
- **Frontend**: `/settings/audit-log` (Admin-only — client-side redirect to
  `/forbidden` for Staff, same pattern as `/users` and
  `/settings/api-keys`; the real control is the API's own `audit:read`
  permission, unchanged), using the same `DataTable`/`useListUrlState`
  pattern every other list page already uses. Columns: When (date + time),
  Actor (resolved to a name via the existing `/users/options`, or
  "System" for the null-actor intake-path rows), Action (a cosmetically
  humanised label — `user.role_changed` → "User role changed" — the raw
  value is still what the Action filter matches against), Record (a link
  to the actual detail page for entity types that have one — lead,
  company, contact, deal, website submission/enquiry — plain text
  otherwise), and Details (the sanitised metadata, rendered as a compact
  `key: value` list). Filters: Action and Entity type (free-text inputs —
  `action`/`entityType` are plain strings in the schema, not a closed
  enum, same reasoning Enquiries' form-type filter already used, D73),
  Actor (a `Select` over `/users/options`), and a From/To date range —
  all four map directly to the existing `GET /audit-events` query
  parameters. **No interactive sort control**: the backend has always
  hardcoded `orderBy: { createdAt: 'desc' }` with no `sort` query
  parameter in its schema at all, and the user's own requirement was
  "sorting by time (newest first)," read as specifying the required
  (and only sensible) order for an audit trail, not as a request for a
  sort-direction toggle — kept as-is rather than adding backend scope that
  wasn't asked for.
- **Nav item**: "Audit Log" (a `history` icon), Admin-only, placed directly
  after API Keys in the sidebar's Admin section, per the user's instruction.
- **Testing**: 5 new backend unit tests
  (`tests/lib/audit-metadata.test.ts` — passthrough of every real key in
  use, dropping an unlisted key, dropping each of 8 specifically
  dangerous-sounding key names, `null`/non-object handling, returning
  `null` rather than `{}` once everything is dropped) plus 3 new backend
  integration tests in the existing `tests/audit/list.test.ts` (Staff
  refused with `403`, unauthenticated refused with `401`, and the
  poisoned-row end-to-end proof above — the existing filter/pagination/
  newest-first tests in that file already covered "Admin sees entries" and
  "filters work" and needed no change). 4 new frontend tests
  (`tests/components/audit-log-page-client.test.tsx`): Staff is redirected
  to `/forbidden` and renders nothing; an Admin sees a real entry rendered
  with its actor name resolved; changing the Action filter input updates
  the URL query (`router.replace` called with `action=...`) the same way
  every other list page's filters do; and a defensive check that the
  component itself never renders a raw-looking key/hash pattern even if
  it were somehow present (belt-and-braces on top of the backend proof,
  not a replacement for it).
- **Verified**: `pnpm typecheck`/`pnpm lint` clean across the whole repo (0
  errors, the same 3 pre-existing `apps/web` warnings). **apps/api
  478/478 (up from 470), apps/web 101/101 (up from 97) — 579 total, all
  passing.** README's permission table, `docs/MANUAL-TEST-DAY5B.md` (a new
  §3 with exact click-through steps, verifying no raw secret ever appears
  in the Details column), and this entry were all updated in the same
  pass. No schema or migration change — the existing `AuditEvent` table
  and `GET /audit-events` route needed nothing new.

## D82 — Bug found in manual testing: Excel's SYLK misdetection broke every CSV export; `check-dockerignore` rewritten off `sh` (2026-11-24)

Two independent fixes reported together; the user found both by actually
using what was built rather than trusting it.

**The CSV bug.** Opening `leads-export-2026-11-24.csv` in Excel on Windows
failed with "Excel has detected that the file is a SYLK file, but cannot
load it." Root cause confirmed by reading the raw first bytes of a real
export, not assumed: Excel has a long-standing, well-documented
misdetection where a text file whose very first cell is the bare two
letters `ID` gets sniffed as an old SYLK spreadsheet file (which
historically begins `ID;...`) instead of plain CSV, and Excel then refuses
to open it at all. **Every one of this app's four exports started their
header row with a bare `ID` column** — confirmed by grepping every export
column list, not sampled.

- **Fix 1 — renamed the first column in all four exports** to a
  resource-specific name that can never be the bare text "ID":
  `LEAD_EXPORT_COLUMNS` → "Lead ID", `COMPANY_EXPORT_COLUMNS` → "Company
  ID", `CONTACT_EXPORT_COLUMNS` → "Contact ID", `DEAL_EXPORT_COLUMNS` →
  "Deal ID" (all in their respective `*.service.ts` files).
- **Fix 2 — a structural guard, not just the four call-site renames**:
  `rowsToCsv()` (`apps/api/src/lib/csv.ts`) now throws immediately if the
  first column's header is ever the bare text "ID" again (case-
  insensitive, whitespace-trimmed), naming the exact SYLK misdetection in
  the error message. This is deliberate defense-in-depth: the four
  existing exports are fixed either way, but a *future* export built
  without remembering this specific Excel quirk would otherwise ship the
  same bug silently — now it fails loudly, at the point `rowsToCsv` is
  called, instead of shipping a file Excel can't open.
- **Fix 3 — a UTF-8 byte-order mark (BOM) now leads every export**, so
  Excel reads non-ASCII characters (e.g. the rupee sign, or an accented
  name) with the correct encoding instead of guessing from raw bytes. Not
  a replacement for fix 1/2 — both were asked for and both are real,
  independent defenses — just an additional correctness fix for encoding,
  done at the same time since it touches the exact same function.
- **CRLF line endings were already correct** — `rowsToCsv` already joined
  rows with `\r\n` before this session; confirmed, not changed.
- **Formula-injection escaping (the pre-existing defence from D76) is
  unaffected** — the BOM is prepended to the whole document after all
  per-cell escaping/quoting has already happened, so it cannot interact
  with, mask, or weaken that defence; verified with a dedicated test
  (quotes, commas, and a newline in the same document as the BOM, all
  still handled correctly).
- **Testing**: `tests/lib/csv.test.ts` gained a BOM-presence assertion
  (replacing the previous exact-string equality tests, now expecting the
  BOM prefix), a dedicated "starts with the BOM, never with the bare
  letters ID" test, a quotes/commas/newline-still-work-with-the-BOM test,
  and three tests for the new guard (throws for a bare "ID" header in any
  case/whitespace variant; does not throw for "Lead ID" or when "ID" is
  not the first column). Each of the four export integration test files
  (`tests/{leads,companies,contacts,deals}/export.test.ts`) gained an
  assertion reading the **raw** response text's first character code
  (`0xfeff`) and confirming the two characters immediately after it are
  never `ID` — proving this end to end through the real HTTP response, not
  only at the `rowsToCsv` unit level. Confirmed empirically, not assumed,
  that `supertest`'s `res.text` preserves a leading BOM exactly as sent
  (verified with a throwaway diagnostic test before relying on this) —
  the existing header-equality assertions pass regardless because
  JavaScript's own `String.prototype.trim()` already strips `﻿` as
  whitespace (part of the ECMAScript `WhiteSpace` production), which is
  why those assertions needed only a text update (the new "Lead ID" etc.
  headers), not BOM-handling logic of their own.

**The `check-dockerignore` bug.** `pnpm docker:check-env-leak` (D79) failed
on Windows cmd/PowerShell with `sh` not found — the guard script itself
was a POSIX shell script, which this project's own standing convention
(every other script here is Node/TypeScript, `apps/api/scripts/*.ts` run
via `tsx`, or root `scripts/dev.mjs`) never actually required, and Windows
has no POSIX `sh` on PATH by default.

- **Rewritten as `scripts/check-dockerignore.mjs`** — plain Node ESM, no
  build step, matching `scripts/dev.mjs`'s own existing root-level
  convention exactly (the only other root-level script). Every Docker
  invocation uses `spawnSync('docker', [...argv])` — never `execSync` or
  `shell: true` — so there is no shell anywhere, host or container: the
  inline throwaway Dockerfile is piped to `docker build -f -` via
  `spawnSync`'s own `input` option (no temp file needed), and `find`'s
  `(`/`-o`/`)`/`!` tokens are passed as literal, separate argv elements to
  `docker run <image> find ...` directly — no inner `sh -c` wrapper either,
  simplifying the original shell version rather than just porting it
  line-for-line. `docker` itself is a real executable on Windows (Docker
  Desktop installs `docker.exe` directly, not a `.cmd` shim), so none of
  `apps/api/scripts/lib/run-cli.ts`'s `process.execPath`-redirection
  machinery is needed here — that pattern exists specifically for
  npm/pnpm-installed JS CLIs that *do* get wrapped in a `.cmd` shim on
  Windows, which `docker` is not.
- **`package.json`'s `docker:check-env-leak` script updated** to `node
  scripts/check-dockerignore.mjs`; the old `scripts/check-dockerignore.sh`
  deleted, not kept alongside.
- **Proven to still catch the original bug, exactly the same way D79's
  version was** — not just shown to pass now: run against a restored copy
  of the original broken `.dockerignore`, it correctly fails and names all
  three leaked files (`apps/api/.env`, `apps/api/.env.staging.local`,
  `apps/web/.env`); restoring the fixed version and re-running passes.
  Confirmed the throwaway check image (`growspark-dockerignore-check:tmp`)
  is cleaned up after every run, pass or fail, via a `try/finally` around
  the whole check (the original `.sh` used a `trap ... EXIT`; the `.mjs`
  version's `finally` is the direct equivalent).
- **Verified end to end**: `pnpm run docker:check-env-leak` (via pnpm, not
  just `node scripts/check-dockerignore.mjs` directly) produces the same
  result.

**Full regression after both fixes**: `pnpm typecheck`/`pnpm lint` clean
across the whole repo (0 errors, the same 3 pre-existing `apps/web`
warnings). **apps/api 483/483 (up from 478), apps/web 101/101 (unchanged
— no web code touched this entry) — 584 total, all passing.** No schema,
migration, permission, or dependency change. Nothing committed or pushed.
