# Staging

A hosted copy of this CRM for demos and manual testing — the **web app on
[Vercel](https://vercel.com)**, the **API on [Render](https://render.com)**
(one manual Web Service, not a Blueprint — see D69), and the database in a
Supabase Postgres project, isolated in its own `sales` schema behind its own
`sales_app` database role. It is **not** production: it exists to click
through the app outside your own laptop, with fictional data only.

Read this file start to finish before touching anything here for the first
time. It assumes you already have:

- A Supabase project ("growspark-workspace") with a `sales` schema and a
  `sales_app` role that can create objects only in that schema.
- `pnpm staging:migrate` and `pnpm staging:create-admin` already run
  successfully once against it (if not, see "Running the staging scripts"
  below before anything else).

## What runs where

| Piece | Runs on | Notes |
| --- | --- | --- |
| API (Express) | Render, service `growspark-crm-api`, one manual Web Service | Built from `apps/api`; the only thing that ever talks to Supabase. |
| Web (Next.js) | Vercel, one project | Proxies `/api/*` to the API's public Render URL over HTTPS. The browser only ever talks to the Vercel origin — see "Order of operations" below for why this is same-origin from the browser's point of view even though the two services are on different platforms. |
| Database | Supabase, project "growspark-workspace", schema `sales` | Shared with two other apps eventually, each in its own schema; this app only ever sees `sales`. |

Nothing runs "staging" automatically. You run the staging scripts from your
own machine (against `apps/api/.env.staging.local`, which only you can read
or edit — this tool never touches it), and you deploy the Render service and
the Vercel project from the `main` branch of this repo whenever you choose
to.

## `apps/api/.env.staging.local`

Copy `apps/api/.env.staging.local.example` to `apps/api/.env.staging.local`
and fill in every value — that file is git-ignored and this tool will never
read, create, edit or delete it. The table below is what each variable is
and where its value comes from.

| Variable | Where the value comes from | Notes |
| --- | --- | --- |
| `NODE_ENV` | Fixed: `production` | Required exactly as-is — see `.example` file comment. |
| `APP_ENV` | Fixed: `staging` | Add this line yourself if your file predates it — see "The APP_ENV line" below. |
| `PORT` | Fixed: `4000` | Only used when running a script locally against staging; Render assigns its own port for the deployed service and ignores this. |
| `DATABASE_URL` | Supabase dashboard → Project Settings → Database → Connection string → **Session pooler** (port 5432, not the 6543 transaction pooler) | Append `&schema=sales`. Use `&sslmode=verify-full` — see "TLS" below, this is required, not optional. |
| `DATABASE_SCHEMA` | Fixed: `sales` | Must exactly match the `?schema=` in `DATABASE_URL` above, or every staging script refuses to start (D59). |
| `DATABASE_POOL_MAX` | Fixed: `5` | Supabase's free tier has few connections available. |
| `DATABASE_SSL_CA` | Supabase dashboard → Project Settings → Database → **SSL Configuration** → download the CA certificate | A local file path (e.g. `D:\path\to\supabase-ca.crt`) or the certificate's own text pasted in directly. Required — see "TLS" below. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Leave unset | The insecure escape hatch; not needed. |
| `ALLOWED_ORIGINS` | The web app's Vercel URL, once you know it (e.g. `https://growspark-crm.vercel.app`) | Only needed for running things locally against staging; the deployed API service gets this from Render's own env vars (below), not this file. |
| `TRUST_PROXY` | Fixed: `false` | Stays `false` even on Render — see D60. |
| `SESSION_TTL_DAYS` | Fixed: `7` | Same as local dev. |

Do **not** set `SEED_ADMIN_PASSWORD`/`SEED_STAFF_PASSWORD` here — staging
must never get the two local-dev demo accounts (D62). The first Admin is
created interactively instead (below).

### The `APP_ENV` line

`APP_ENV` is newer than the rest of this file (D64) and tells staging apart
from Render's real production deployment — both run with `NODE_ENV=production`,
so that alone isn't enough. If your `.env.staging.local` was created before
this was added, open it yourself and add:

```
APP_ENV=staging
```

Without it, `pnpm staging:seed-sample` refuses to run at all.

## TLS

**`DATABASE_SSL_CA` is required, not optional — and it must be paired with
`sslmode=verify-full` in `DATABASE_URL`.** This corrects earlier guidance in
this file (see D66 and D68 in `docs/decisions.md` for the full story of how
that was found to be wrong).

A read-only check of the pooler's own certificate (no Postgres login
involved) shows its chain is signed by **Supabase's own private root CA**
(`Supabase Root 2021 CA` → `Supabase Intermediate 2021 CA`), not a public
one — Node's built-in trusted CA list does not include it. So `DATABASE_URL`
alone, with no `DATABASE_SSL_CA`, cannot actually verify the connection; a
plain `sslmode=require`/`verify-full` with nothing else will fail (or,
depending on the exact `pg` version installed later, could silently stop
even trying to verify — see D66).

There was also a real, separate bug, now fixed in this repo's code
(`src/lib/database-ssl.ts`, D68): the `pg` library's own connection-string
parser discards *any* explicitly-configured CA the moment it sees `sslmode=`
in the URL at all, regardless of its value. Setting `DATABASE_SSL_CA` while
`sslmode` was present in `DATABASE_URL` used to be silently ignored
entirely — this is why it looked like the downloaded certificate "didn't
work." The app now strips `sslmode` from the connection string itself
whenever `DATABASE_SSL_CA` (or `DATABASE_SSL_REJECT_UNAUTHORIZED`) is set, so
this no longer happens; nothing to do differently in your own file for this
part, just know it's handled.

**What to put in `.env.staging.local`**:

```
DATABASE_URL=postgresql://...?schema=sales&sslmode=verify-full
DATABASE_SSL_CA=D:\path\to\your\downloaded\supabase-ca.crt
```

Get the certificate from Supabase's dashboard: Project Settings → Database →
**SSL Configuration** → download the CA certificate. A Windows path with
backslashes is read correctly as-is (verified; no escaping needed, no
forward slashes required).

**Check it worked** with the read-only diagnostic script before running
anything that writes data:

```bash
pnpm staging:check-db
```

Prints the database host, the schema, and either `OK` or the exact failure —
never credentials. If it still fails, the printed error is the real
underlying TLS/connection error; send it back rather than guessing at a fix.

## Running the staging scripts

All from `apps/api/`, in this order:

```bash
pnpm staging:check-db
```

Read-only — connects with the exact same logic the API itself uses, runs
`SELECT 1` and counts organisations, and prints the host, schema, and `OK` or
the failure. Safe to run any time, including before you've migrated anything
(an empty/missing `sales` schema just means `OK` with `0` organisations, not
a failure). Confirms the connection and TLS setup work before anything
writes data.

```bash
pnpm staging:migrate
```

Applies the schema to Supabase (idempotent — safe to re-run after a schema
change; it only applies migrations that haven't run yet).

```bash
pnpm staging:create-admin
```

Interactive — prompts for a name, email and a hidden password (never typed
as a command argument), creates the organisation if it doesn't exist yet
(Asia/Kolkata, INR, lead sources, Sales Pipeline and stages), and the first
Admin.

```bash
pnpm staging:seed-sample -- --confirm
```

Optional. Writes fictional sample data (companies, contacts, leads, deals,
activities) for a demo. Refuses without `--confirm`; refuses entirely unless
`APP_ENV=staging` and `DATABASE_SCHEMA=sales` (D64).

Every one of these prints the database host and schema it's about to use —
check that before it does anything, especially the first time.

## Deploying — order of operations

The API and the web app's URLs are each other's inputs (the API needs the
web app's URL for `ALLOWED_ORIGINS`; the web app needs the API's URL for
`API_INTERNAL_URL`), so there's an unavoidable two-pass bootstrap the first
time. After that, both URLs are fixed and you only ever redeploy, never
re-wire.

1. **Push this repo to GitHub** if it isn't already there (this tool never
   pushes — that's still on you). Both Render and Vercel deploy from GitHub.
2. **Create the Render Web Service first** (see "Render: API" below). Render
   assigns its public URL (`https://<name>.onrender.com`) as soon as you
   pick the service name, before the first build even finishes — note it
   down. For `ALLOWED_ORIGINS` on this first pass, you don't know the Vercel
   URL yet; enter a harmless placeholder like `https://placeholder.invalid`
   for now. Nothing should be making cross-origin writes against the API
   yet, so a temporarily-wrong allow-list costs nothing.
3. **Create the Vercel project second** (see "Vercel: web" below), setting
   `API_INTERNAL_URL` to the real Render API URL from step 2. Vercel assigns
   its own project URL (`https://<project>.vercel.app`) on first deploy —
   note it down.
4. **Go back to the Render service's Environment tab and fix
   `ALLOWED_ORIGINS`** to the real Vercel URL from step 3 (exact origin —
   scheme + host, no trailing slash, no path). Saving an environment
   variable on Render triggers an automatic redeploy of that service by
   itself; if it doesn't, use **Manual Deploy** → **Deploy latest commit**.
5. Once both show **Live** (Render) / **Ready** (Vercel), open the Vercel
   URL and sign in with the Admin account `pnpm staging:create-admin`
   created.

Any later change to either URL (a custom domain, a renamed service) means
repeating step 4 — the API's `ALLOWED_ORIGINS` is the one place the Vercel
URL is configured, and the Vercel project's `API_INTERNAL_URL` is the one
place the Render URL is configured. Nothing else in the code hard-codes
either address.

## Render: API (manual Web Service, not a Blueprint)

`render.yaml` at the repo root documents these exact same settings for
reference (build/start commands in one place you can diff against) but is
**not applied as a Blueprint** — create this as one manual service instead,
per the change of plan recorded in D69.

1. Go to [dashboard.render.com](https://dashboard.render.com) and sign in
   (GitHub sign-in is easiest, since Render needs repo access either way).
2. Click **New +** → **Web Service**, connect your GitHub account if asked,
   and pick this repository.
3. Fill in these exact settings:

| Setting | Value |
| --- | --- |
| Name | `growspark-crm-api` (global across all Render accounts — part of the `.onrender.com` URL; if taken, pick anything and note down what you end up with) |
| Language/Runtime | **Node** |
| Branch | `main` |
| Region | **Singapore** — closest Render region to the Supabase project's Mumbai (`ap-south-1`) region; Render has no Mumbai region itself |
| Root Directory | **leave blank** (repo root) — the build command below runs `pnpm --filter` commands from the monorepo root; setting a Root Directory of `apps/api` would break that |
| Build Command | `corepack enable && corepack prepare pnpm@11.10.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @growspark/shared build && pnpm --filter api exec prisma generate && pnpm --filter api build` |
| Start Command | `node apps/api/dist/index.js` |
| Health Check Path | `/health` |
| Instance Type | **Free** |
| Auto-Deploy | **Yes** (on push to `main` — this tool never pushes, so this only fires when you push yourself) |

Note on the Start Command: **not** `pnpm --filter api start` — that script
runs `node --env-file=.env dist/index.js`, and Node's `--env-file` fails hard
(exit code 9) if the file doesn't exist, which it never will on Render (env
vars are injected directly into `process.env`, no `.env` file involved at
all). `src/env.ts` already reads `process.env` directly with no file-loading
step of its own, so the plain `node apps/api/dist/index.js` just runs the
compiled output against whatever Render injected.

4. Before clicking **Create Web Service**, add every environment variable
   below (Render's manual-service form has an **Environment Variables**
   section right on the create page — you don't need a second trip to the
   Environment tab unless you want to fix `ALLOWED_ORIGINS` later per step 4
   of "Order of operations" above).

### Render environment variables (`growspark-crm-api`)

Every value comes straight from your own `apps/api/.env.staging.local` (the
table earlier in this file), with the exceptions noted:

| Variable | Required/Optional | Exact value to type | From `.env.staging.local`? |
| --- | --- | --- | --- |
| `NODE_ENV` | Required | `production` | Yes |
| `APP_ENV` | Required | `staging` | Yes |
| `DATABASE_URL` | Required | the full `postgresql://...?schema=sales&sslmode=verify-full` string | Yes — never type this by hand, copy it |
| `DATABASE_SCHEMA` | Required | `sales` | Yes |
| `DATABASE_POOL_MAX` | Required | `5` | Yes |
| `DATABASE_SSL_CA` | Required | **not** the file path — paste the certificate's own PEM text; see "The CA certificate on Render" below | No — the file path in `.env.staging.local` doesn't exist on Render |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Optional | leave unset/blank | No — unused escape hatch |
| `ALLOWED_ORIGINS` | Required | the real Vercel web app URL, e.g. `https://growspark-crm.vercel.app` (placeholder on the very first create — see "Order of operations") | **No** — this is the one value that is never a secret and never comes from this file; it's the Vercel URL |
| `TRUST_PROXY` | Required | `false` | Yes |
| `SESSION_TTL_DAYS` | Required | `7` | Yes |

`PORT` is **not** in this list — Render assigns and injects its own, and
`src/index.ts` already calls `app.listen(env.PORT, ...)`, which reads
whatever Render gives it. Adding a `PORT` row yourself would just override a
value Render needs to control.

None of these values are secrets you should ever paste into chat, a commit,
or anywhere outside Render's own environment variable fields and your own
`.env.staging.local`.

#### The CA certificate on Render

`DATABASE_SSL_CA` accepts either a file path or the certificate's own PEM
text directly (`src/lib/database-ssl.ts` detects which by checking for the
`-----BEGIN` header) — this is exactly what makes it work on Render, which
has no `D:` drive or any filesystem path you control at all. Don't put the
Windows path from your own `.env.staging.local` into Render's env var field;
instead:

1. Open the downloaded `supabase-ca.crt` in any text editor.
2. Copy its entire contents, including the `-----BEGIN CERTIFICATE-----` and
   `-----END CERTIFICATE-----` lines.
3. Paste that whole block as the value of `DATABASE_SSL_CA` in Render's
   environment variable field. Render's env var values support multi-line
   text, so the line breaks inside the certificate are preserved correctly.

With `DATABASE_SSL_CA` set this way, certificate verification is fully on —
`rejectUnauthorized: true` together with this CA (`resolveDatabaseSsl()` in
`src/lib/database-ssl.ts`), the same as running it locally. `DATABASE_SSL_REJECT_UNAUTHORIZED`
is a separate, independent escape hatch that disables verification entirely;
leaving it unset on Render keeps verification on regardless of how the CA is supplied.

## Vercel: web

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub, then
   **Add New** → **Project** → import this repository.
2. On the **Configure Project** screen, set:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` — click **Edit** next to Root Directory and select it |
| "Include files outside the root directory in the Build Step" | **On** — required: this is a pnpm workspace, so the build needs the repo-root `pnpm-workspace.yaml`, root `pnpm-lock.yaml`, and `packages/shared` to exist alongside `apps/web`. Left off, install fails — Vercel only uploads the Root Directory's own subtree by default. |
| Framework Preset | **Next.js** (auto-detected once Root Directory is set) |
| Node.js Version | **22.x** (Project Settings → General → Node.js Version — matches the repo's pinned `engines.node: ">=22.12"`, same major as the `22.20.0` used locally and on Render) |
| Install Command (override) | `corepack enable && corepack prepare pnpm@11.10.0 --activate && cd ../.. && pnpm install --frozen-lockfile` |
| Build Command (override) | `cd ../.. && pnpm --filter @growspark/shared build && pnpm --filter web build` |
| Output Directory | **leave as default** — Next.js preset auto-detects `apps/web/.next` once Root Directory is set; don't override it |

Why the `cd ../..` in both commands: with Root Directory set to `apps/web`,
Vercel runs the Install/Build commands with that as the working directory.
`pnpm --filter @growspark/shared build` and `pnpm --filter web build` are
workspace-filter commands — they only resolve correctly when `pnpm` is
invoked from the monorepo root (`apps/web` is two levels down from
`d:\GrowSpark\growspark-sales-crm`, so `cd ../..` reaches it). `pnpm --filter
@growspark/shared build` must run before `pnpm --filter web build` because
`apps/web` imports `@growspark/shared`'s **compiled** `dist` output, not its
TypeScript source (D9) — skipping that step reproduces the exact "stale/
missing dist" failure mode D12 already hardened against locally, just on
Vercel instead. Despite the `cd`, the actual `next build` invocation (run
*by* `pnpm --filter web build`, with its own cwd set to `apps/web`
internally) still writes `.next` under `apps/web/` — matching where the
Output Directory setting expects it.

3. Add the one environment variable below, then click **Deploy**.

### Vercel environment variables

| Variable | Exact value to type |
| --- | --- |
| `API_INTERNAL_URL` | the real `growspark-crm-api` Render URL, e.g. `https://growspark-crm-api.onrender.com` (no trailing slash) |

Set this for the **Production** environment (the one that serves your
`main`-branch deployment); leave Preview/Development unset unless you later
want preview deployments to also reach the staging API.

**Do not add a `NODE_ENV` variable.** Vercel sets `NODE_ENV=production`
itself for Production builds/runtime automatically; manually adding it only
risks it diverging from what Vercel's own build pipeline expects.

### `API_INTERNAL_URL` and the `/api/*` rewrite, explained

`apps/web/next.config.ts`'s `rewrites()` is unchanged by this split — it
still proxies `/api/:path*` to `${API_INTERNAL_URL}/api/:path*`. The only
difference from the original same-Render-account plan is that
`API_INTERNAL_URL` now points at a public internet address
(`https://growspark-crm-api.onrender.com`) rather than a sibling service —
there never was a private-network address in play even in the original
plan (`render.yaml` always used the public `.onrender.com` URL for this),
so nothing here is a new kind of address, just a different platform hosting
the other end.

**Does this still preserve cookies and the Origin check, now that the two
halves are on different platforms?** Yes, for the same reason it worked
when both were on Render: Next.js's `rewrites()` to an external, fully-
qualified destination is a genuine **proxy**, not an HTTP redirect — the
browser's request and response both stay on the Vercel origin
(`https://growspark-crm.vercel.app`) throughout; Next.js's server makes the
actual call to Render on the browser's behalf and relays the response back
unchanged in all the ways that matter here:

- The browser's `fetch()` call to `/api/...` is same-origin to the Vercel
  deployment, so it sends `Origin: https://growspark-crm.vercel.app` (the
  Fetch standard sends `Origin` on every non-GET/HEAD request, same-origin
  or not). Next's rewrite forwards that header through to the API
  unmodified — it isn't something Next's rewrite mechanism rewrites or
  strips. The API's `enforceOriginAndContentType`
  (`apps/api/src/middleware/csrf.ts`) sees exactly that Origin and checks it
  against `ALLOWED_ORIGINS`, which must therefore hold the **Vercel** URL
  (done in step 4 of "Order of operations" above), not the Render API's own
  URL.
- The API's `Set-Cookie` response header (`apps/api/src/lib/cookies.ts`,
  `buildSessionCookieHeader`) carries no `Domain` attribute, so the browser
  scopes the cookie to whichever origin it sees the response as coming
  from — the Vercel origin, since that's the only address the browser ever
  talks to. Next's rewrite relays `Set-Cookie` back to the browser
  unmodified, the same way any reverse proxy does (this is the standard,
  widely-used pattern for exactly this kind of cookie-authenticated BFF
  proxy — not something specific to this app).
- `SameSite=Lax` keeps working for the same reason it always did: from the
  browser's point of view there is still only one origin in play
  (`growspark-crm.vercel.app`). Render is never a cross-site target the
  browser itself talks to.

This is reasoned through from Next.js's documented external-rewrite proxy
behavior, not yet confirmed by an actual login against the live Vercel +
Render pair — add that to "What's still unverified" below until you've
clicked through a real sign-in once both are deployed.

### Redeploying after a code change

Both platforms redeploy automatically on every push to `main` (this tool
never pushes, so this only happens when you push yourself):

- **Render**: redeploys on push, and also redeploys automatically whenever
  you save a changed environment variable. To force one without a new
  commit, open the service and click **Manual Deploy** → **Deploy latest
  commit**.
- **Vercel**: redeploys on push, and also redeploys automatically whenever
  you save a changed Project Settings environment variable (Vercel prompts
  you to redeploy, it isn't fully automatic the way Render's is — click
  **Redeploy** when it offers). To force one without a new commit, open the
  project's **Deployments** tab and use **Redeploy** on the latest one.

A schema change needs `pnpm staging:migrate` run again (from your own
machine, against `.env.staging.local`) either way — neither service's
build/start command runs migrations by itself, so a migration is always a
deliberate, visible step you take, never an automatic side effect of a
deploy.

## Supabase pausing

Supabase's free tier pauses a project after a period of inactivity (check
the current limit on your project's dashboard — it has changed between
Supabase's own pricing updates). A paused project refuses every connection,
including Render's — the API service will report database errors, not a
crash. Fix: open the Supabase dashboard, find the project, click to unpause
it (usually a single button), wait about a minute, then everything works
again with no other change needed.

## Render free-tier cold starts

Render's free web services spin down after about 15 minutes of no traffic
and take roughly 30–60 seconds to wake back up on the next request — the
first click after a quiet period will just look slow, not broken. This
applies to both services independently. There is nothing to configure here;
it's a free-tier limitation, documented so it isn't mistaken for a bug
during a demo.

## Resetting staging safely

There is no `staging:reset` command, deliberately — this project's own
rules (`CLAUDE.md`) require asking before any destructive command, and
Prisma's own CLI already refuses `migrate reset` without fresh, in-the-moment
consent. `pnpm staging:migrate` itself is never destructive (`prisma migrate
deploy` only applies pending migrations; it never drops anything).

If you ever genuinely need to wipe staging's data and start over: that's a
manual, deliberate action in Supabase's own SQL editor (drop and recreate
the `sales` schema, or truncate its tables), done by you, not run from this
repo. Ask first if you want help drafting that SQL when the time comes —
it isn't written here in advance on purpose.

## Did any code assume both services lived together on Render?

Checked deliberately, since splitting the two services across platforms is
exactly the kind of change that surfaces a hidden same-host assumption.
Found: **none that needed fixing** — the app was already built assuming the
API never knows or cares what's on the other side of `ALLOWED_ORIGINS`/the
proxy, because D21/D23 (package 1.3b) had already established that the
Next.js rewrite in front of the API doesn't forward real client info, so the
code never assumed a trusted private network to begin with:

- **Origin checks** (`csrf.ts`) — purely driven by the `ALLOWED_ORIGINS` env
  var already; no code reads or assumes a Render-specific hostname anywhere.
  Just needs the real value (the Vercel URL) set, per "Order of operations".
- **`trust proxy`** (`app.ts`, `env.ts`) — stays `false`, unchanged. D21's
  finding (the proxying layer in front of the API forwards neither
  `X-Forwarded-For` nor `X-Forwarded-Proto`) is about Next.js's `rewrites()`
  mechanism itself, not about which platform runs it — equally true whether
  that Next.js process is on Render or Vercel.
- **Secure cookies** (`cookies.ts`) — driven by `NODE_ENV === 'production'`,
  which Render sets regardless of what's hosting the web app; both Render
  and Vercel serve over HTTPS, so `Secure` cookies work either way. No
  `Domain` attribute is set, which is exactly what makes the cross-platform
  split work at all (see the `/api/*` rewrite explanation above).
- **The rate limiter** (`rate-limit.ts`) — the global flood ceiling (not a
  per-IP limiter) was already designed around "the real client IP never
  reaches this process," per D21/D23. That's unaffected by which platform
  sits in front of it.
- **No `cors` package is used anywhere** in `apps/api` — confirmed by
  searching the source. There was never a CORS allow-list to update, because
  the browser was never meant to talk to the API's own origin directly, on
  Render or anywhere else — only ever through the web app's same-origin
  proxy. That design assumption holds exactly as well with Vercel in front.
- **`render.yaml`** — this did assume co-location (it was a two-service
  Blueprint). Updated to describe only the API service, and labelled as
  documentation only, not an applied Blueprint — see D69.

## What's still unverified

- A real sign-in against the live Vercel + Render pair, to confirm the
  cross-platform cookie/Origin passthrough reasoned through above actually
  behaves as expected end to end (nothing here suggests it wouldn't, but it
  hasn't been clicked through).
- The real `sales_app` role's exact grant boundaries beyond what's actually
  been exercised so far (a migration and one admin-user insert) — see D65.
- The `DATABASE_SSL_CA` fix (D68) was verified by this tool without ever
  making a real connection — `pnpm staging:check-db` against the actual
  Supabase project, with the corrected `.env.staging.local`, is the real
  confirmation and hasn't happened yet as of this writing.
- Behaviour once the same Supabase project is shared with the other two
  apps it's eventually meant to host.
- The full P0 feature set hasn't been clicked through against this live
  deployment yet — only the database steps above have.
