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
