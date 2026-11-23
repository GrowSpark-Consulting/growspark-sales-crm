# Staging

A hosted copy of this CRM for demos and manual testing — the API and web app
on [Render](https://render.com), the database in a Supabase Postgres
project, isolated in its own `sales` schema behind its own `sales_app`
database role. It is **not** production: it exists to click through the app
outside your own laptop, with fictional data only.

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
| API (Express) | Render, service `growspark-crm-api` | Built from `apps/api`; the only thing that ever talks to Supabase. |
| Web (Next.js) | Render, service `growspark-crm-web` | Proxies `/api/*` to the API service over HTTPS, same-origin from the browser's point of view (D1). |
| Database | Supabase, project "growspark-workspace", schema `sales` | Shared with two other apps eventually, each in its own schema; this app only ever sees `sales`. |

Nothing runs "staging" automatically. You run the staging scripts from your
own machine (against `apps/api/.env.staging.local`, which only you can read
or edit — this tool never touches it), and you deploy the two Render
services from the `main` branch of this repo whenever you choose to.

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
| `DATABASE_URL` | Supabase dashboard → Project Settings → Database → Connection string → **Session pooler** (port 5432, not the 6543 transaction pooler) | Append `&schema=sales` to the end. See "TLS" below for a recommended edit to `sslmode`. |
| `DATABASE_SCHEMA` | Fixed: `sales` | Must exactly match the `?schema=` in `DATABASE_URL` above, or every staging script refuses to start (D59). |
| `DATABASE_POOL_MAX` | Fixed: `5` | Supabase's free tier has few connections available. |
| `DATABASE_SSL_CA` / `DATABASE_SSL_REJECT_UNAUTHORIZED` | Leave both unset | Confirmed unnecessary — see "TLS" below. |
| `ALLOWED_ORIGINS` | The web service's Render URL, once you know it (e.g. `https://growspark-crm-web.onrender.com`) | Only needed for running things locally against staging; the deployed API service gets this from Render's own env vars (below), not this file. |
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

**Certificate verification is on.** Confirmed both by actually connecting
(`pnpm staging:migrate`/`staging:create-admin` succeeded) and by reading
`pg`'s own connection-string parsing logic directly: Supabase's connection
string includes `sslmode=require`, and the installed `pg-connection-string`
version currently treats `require` as an alias for `verify-full` — full
certificate chain and hostname verification, using Node's built-in trusted
CA bundle. Neither `DATABASE_SSL_CA` nor `DATABASE_SSL_REJECT_UNAUTHORIZED`
is needed, and both should stay unset.

**One recommended edit, when you have a moment**: that `require` →
`verify-full` aliasing is explicitly called out by `pg-connection-string`
itself as temporary — a future major version will make `require` mean only
"encrypt, don't verify identity," the weaker standard libpq meaning. A
routine dependency update later could silently weaken this with no error and
no code change to notice it by. The fix costs nothing today: in
`DATABASE_URL`, change `&sslmode=require` to `&sslmode=verify-full`
explicitly. Functionally identical right now, immune to that future change.
See D66 for the full detail.

## Running the staging scripts

All from `apps/api/`, in this order:

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

## Deploying to Render

This repo has a `render.yaml` at its root (a "Blueprint") that describes both
services. You only have to click through the setup once; after that, a
redeploy is one click.

1. Push this repo to GitHub if it isn't already there (this tool never
   pushes — that's still on you).
2. Go to [dashboard.render.com](https://dashboard.render.com) and sign in
   (GitHub sign-in is easiest, since Render needs repo access either way).
3. Click **New +** → **Blueprint**.
4. Connect your GitHub account if asked, then pick this repository.
5. Render reads `render.yaml` and shows you two services:
   `growspark-crm-api` and `growspark-crm-web`. If either name is already
   taken by someone else on Render (names become part of the public
   `.onrender.com` URL, so they're global, not per-account), Render will ask
   you to change it — pick anything, just note down whatever you end up
   with, since it changes the URLs below.
6. Before clicking **Apply**, Render will prompt you for every environment
   variable the blueprint declares (it lists names, never values — that's
   `render.yaml`'s `sync: false` on every entry). Fill them in using the
   table in the next section. You can also leave them blank for now and set
   them after, under each service's **Environment** tab.
7. Click **Apply**. Render builds and starts both services — the first
   build takes several minutes (it's compiling TypeScript and generating the
   Prisma client, not just installing packages).
8. Once both services show **Live**, open the web service's URL
   (`https://<your-web-service-name>.onrender.com`) and sign in with the
   Admin account `pnpm staging:create-admin` created.

### Environment variables to enter in Render

**`growspark-crm-api`** — every value here comes straight from your own
`apps/api/.env.staging.local` (the table earlier in this file), with one
exception:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | from `.env.staging.local` |
| `APP_ENV` | from `.env.staging.local` |
| `DATABASE_URL` | from `.env.staging.local` |
| `DATABASE_SCHEMA` | from `.env.staging.local` |
| `DATABASE_POOL_MAX` | from `.env.staging.local` |
| `DATABASE_SSL_CA` | leave blank (unused — see "TLS" above) |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | leave blank (unused) |
| `ALLOWED_ORIGINS` | **not** from `.env.staging.local` — use the real `growspark-crm-web` Render URL from step 5 above, e.g. `https://growspark-crm-web.onrender.com` |
| `TRUST_PROXY` | from `.env.staging.local` (`false`) |
| `SESSION_TTL_DAYS` | from `.env.staging.local` |

`PORT` is not in this list at all — Render assigns and injects its own, and
the app already reads whatever Render gives it.

**`growspark-crm-web`**:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `API_INTERNAL_URL` | the real `growspark-crm-api` Render URL from step 5, e.g. `https://growspark-crm-api.onrender.com` |

### Redeploying after a code change

Once connected, Render redeploys automatically on every push to `main` (this
tool never pushes, so this only happens when you push yourself). To redeploy
manually without a new commit — e.g. after changing an environment variable
— open the service in the Render dashboard and click **Manual Deploy** →
**Deploy latest commit**.

A schema change needs `pnpm staging:migrate` run again (from your own
machine, against `.env.staging.local`) — Render redeploying the API service
does not run migrations by itself; nothing in `buildCommand`/`startCommand`
does that on purpose, so a migration is always a deliberate, visible step
you take, never an automatic side effect of a deploy.

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

## What's still unverified

- The real `sales_app` role's exact grant boundaries beyond what's actually
  been exercised so far (a migration and one admin-user insert) — see D65.
- Behaviour once the same Supabase project is shared with the other two
  apps it's eventually meant to host.
- The full P0 feature set hasn't been clicked through against this live
  deployment yet — only the database steps above have.
