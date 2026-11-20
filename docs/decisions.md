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
  fully static routes (confirmed in `pnpm build`'s own route list, `○`). Next's
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
