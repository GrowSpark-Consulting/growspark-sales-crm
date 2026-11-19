# Start Here — Next Session

Read this file **first**, before touching any code. It tells you what this
project is, the rules that don't change, what to read next and in what
order, the Day 2 plan as far as it's known, and the specific items left
open at the end of Day 1.

## The project, in brief

- **Sales & CRM** for Grow Spark Consulting — an internal tool for Admin
  and Staff users covering the lead-to-deal journey: leads → companies/
  contacts → deals → pipeline → activities → dashboard.
- This CRM is **one of three independent apps** being built by different
  people (stated by the user; not independently verifiable from this repo
  alone).
- The build is a **7-day plan**: Days 1–5 build, Day 6 testing, Day 7
  stabilise and demo. Day 1 (packages 1.1–1.7) is done.
- A **staging deployment is planned for around Day 4** — see "Day 4" below.
- Single developer, nothing reviewed by anyone else: correctness over
  speed, and every package stops for review before the next one starts.
- TypeScript strict everywhere; `packages/shared`'s Zod schemas are the
  single source of validation; controllers stay thin, services take
  `{ userId, orgId, role }`; every query is organisation-scoped; every
  route declares a permission; multi-table writes are transactional with
  the audit row inside the same transaction.

## Hard rules that don't change

- **The live Grow Spark website is off limits.** This CRM is additive and
  must never disturb the real website, its Supabase database, its SMTP
  sending, its HubSpot integration, or visitor-facing behaviour. The
  website's own repository is not touched, read, or looked for until the
  user approves an **exact file list** in advance — not a general "go
  ahead."
- **This tool never pushes to `git`.** Commit locally, every time; never
  `git push`. The project owner pushes manually, after reviewing each
  report — so `main` already matching `origin/main` at the start of a
  session just means the owner reviewed and pushed what was committed
  before. That is not permission to push from this tool.
- **One work package per prompt, and stop for review after each one.**
  Report what was built, what was verified (commands + actual output), any
  deviation, any new dependency, known gaps, and the next step — then wait.
- **Process hygiene, every time**: record the PID of anything started;
  stop it by exact PID (`taskkill /PID <pid> /T /F` on Windows, never a
  broad pattern match); prove ports 3000 and 4000 are clear before and
  after. Never kill a dev server you didn't start without asking first.
- **Exact version pinning, no `^`/`~` ranges**, anywhere in this workspace.
  Record *why* in `decisions.md` when the choice isn't obvious.
- **Ask before adding any dependency**, running a destructive command
  (`migrate reset`, `git reset --hard`, deleting a Docker volume), or doing
  anything outside the current package's stated scope.
- Prisma's own CLI will refuse certain destructive commands against this
  project unless a human gives fresh, in-the-moment consent — that's
  Prisma's built-in safety check, not something to script around.

## What to read, in order

1. **`CLAUDE.md`** — the short, standing rules (stack, code rules, process
   rules). Checked into the repo, not just chat history.
2. **This file** — you're reading it.
3. **`docs/PROJECT-STATE.md`** — the full handover: status of every
   package, the repository map, the pinned stack and exact versions, every
   command you'll need, ports, environment variable *names*, the database
   setup, coding conventions, gotchas, and the session log. This is the
   detailed reference; skim its table of contents (the `##` headings) and
   come back to specific sections as needed rather than reading linearly
   every time.
4. **`docs/decisions.md`** — every approved decision, D1 through D29,
   append-only, numbered (D3/D5 don't exist — never assigned), each with
   the reasoning behind it. Don't re-litigate something already decided
   here without a new entry.
5. **`apps/api/prisma/SCHEMA-SUMMARY.md`** — the factual per-model
   column/index/FK/CHECK reference for the database. Read this instead of
   `schema.prisma` itself when you just need to know what a table looks
   like.

Only after those five should you start reading application code for the
specific package you're about to work on.

## The Day 2 plan, as far as it's known

**Packages 2.0 through 2.3 are done** (see `PROJECT-STATE.md` §7 for full
detail, `decisions.md` D30–D35). **2.4–2.6 (the frontend UI for leads/
companies/contacts) have not been started and are not detailed in this
repo** — confirm exact scope with the user before building ahead of it;
do not invent package content beyond what's written here.

- **2.0 — Day 1 leftovers — done.** Every protected `page.tsx` is now a
  thin Server Component wrapper carrying its own `export const instant =
  false` (the standing convention for every future page, see
  `PROJECT-STATE.md` §12); `PasswordInput` (show/hide) replaced the three
  bare password `Input`s.
- **2.1 — backend foundations — done.** Normalisers
  (`packages/shared/src/normalize.ts`), the duplicate finder
  (`apps/api/src/lib/duplicates.ts`), `buildOrderBy`
  (`apps/api/src/lib/list-query.ts`), `GET /api/v1/lead-sources`, `GET
  /api/v1/users/options`.
- **2.2 — Companies and Contacts API — done.** Full CRUD + archive/restore
  for both, `apps/api/src/modules/companies/` and `modules/contacts/`.
- **2.3 — Leads API — done.** Full CRUD + archive/restore,
  `POST /leads/:id/status` (the D29 status workflow, no note field — see
  D32), `GET /leads/duplicates`, `GET /leads/:id/status-history`.
  `apps/api/src/modules/leads/`.
- **2.4–2.6 — UI.** The corresponding frontend work for 2.1–2.3's
  Companies/Contacts/Leads APIs. Exact scope not detailed yet — ask.
- **Four rules were approved on 2026-11-19 for this work, and are now
  implemented** (full detail in `decisions.md` D29 — read the real entry,
  not just this summary):
  - Lead status: any open status → any other open status directly;
    `CONVERTED` only through the (Day 3) convert action; every change
    writes a `LeadStatusHistory` row (no note — D32).
  - Lead creation requires a name, plus an email or a phone (not
    necessarily both).
  - Duplicates (exact normalised email, phone, or company name match)
    **warn only** — the record still saves.
  - Staff may create, edit, and archive companies, contacts, and leads
    (same standing as Admin for these three resources only).

## Day 4: staging deployment (as currently planned)

Not yet started, and not part of Day 1 or Day 2's scope — recorded here so
it isn't lost. As currently planned (per the user, 2026-11-19):

- Hosted staging around **Day 4**: the API and web app on **Render**, the
  database on **Supabase**, using a **separate `sales` schema** (not the
  website's own schema) and its **own database role** — i.e. genuinely
  isolated from the live Grow Spark website's data, not just a different
  table prefix in the same schema.
- A **create-first-admin command** will be needed for that environment,
  since the seed script refuses to run in production (by design, D15) and
  there's no admin account otherwise.
- **The website-forwarding patch is explicitly NOT approved and NOT
  applied.** Nothing in this repo should assume or build toward it without
  a fresh, explicit approval naming the exact file list, per the hard
  rules above.

## Open items (verified against the code on 2026-11-19, end of Day 1)

Each of these was re-checked against the actual current code before being
written down below, not carried over on assumption.

**(a) RESOLVED in package 2.0.** `users/page.tsx` is now a thin Server
Component wrapper (`export const instant = false`) rendering
`components/users/users-page-client.tsx`'s `UsersPageClient`, exactly the
planned fix below. Every other protected `page.tsx` follows the same
convention (`PROJECT-STATE.md` §12, `decisions.md` D31). Original note,
kept for context: the Cache Components "instant navigation" dev notice
kept appearing on `/users` even after package 1.7's layout-level fix,
because `users/page.tsx` was a Client Component and Next.js throws if
`instant` is exported from one.

**(b) RESOLVED in package 2.0.** `PasswordInput`
(`apps/web/components/ui/password-input.tsx`, Lucide Eye/EyeOff toggle)
now wraps every password field (`login-form.tsx`, `create-user-dialog.tsx`,
`reset-password-dialog.tsx`). See `decisions.md` D31.

**(c) The Users search value lives in component state, not the URL.**
Confirmed by grep: `apps/web/app/(protected)/users/page.tsx` uses
`useState` for `q`/`page`/`role`/`status`, no `useSearchParams`. Refreshing
the Users page loses any active search/filter/page. Noted (not silently
fixed) back in package 1.7, still accurate.

**(d) No component-level tests for `SearchInput` or
`SessionExpiryHandler`.** Confirmed: `apps/web/package.json` has no
`jsdom` or `@testing-library/react`. The existing `apps/web` tests
(`lib/format.test.ts`, `lib/api-client.test.ts`) are pure-logic only, no
DOM needed. Adding component tests needs both dependencies — ask before
adding, same as `vitest` itself was asked about in package 1.6.

**(e) Does route-change revalidation actually produce a fast redirect, or
only on refresh? — Not reconciled; needs an actual browser test.** The
user reports that a deactivated user's already-open page only redirects to
`/login` after a manual refresh, reacting slowly otherwise, even though
the server already rejects their requests immediately. Code-level tracing
of the implemented mechanism:
- `AuthGuard` (`apps/web/components/auth-guard.tsx`) invalidates the
  `me` query on every `pathname` change after first mount.
- Separately, `apps/web/lib/api-client.ts`'s `apiFetch` calls a registered
  `onUnauthorized` listener on **any** 401 from **any** call, and
  `SessionExpiryHandler` (mounted in `providers.tsx`) uses that to clear
  the whole query cache and `router.replace` to `/login?next=...`,
  independent of `AuthGuard`'s own state.
- Reading `@tanstack/query-core`'s own reducer
  (`node_modules/.pnpm/@tanstack+query-core@5.108.0/.../query.js`,
  the `"error"` dispatch case) confirms a failed background refetch sets
  `status: "error"` unconditionally — it does not silently keep the query
  looking "successful" just because older data exists — so `AuthGuard`'s
  `isError` check should see it.
- On paper, both paths should fire promptly on the next navigation, not
  require a refresh. **This has not been watched happen in an actual
  browser** (no browser-automation tool is available in this environment)
  — the user's own observation contradicts that static reading, and the
  discrepancy is unresolved. Next session: open DevTools' Network tab,
  deactivate a signed-in user from a second window, click a sidebar link
  in the first, and watch whether `/auth/me` actually re-fires and what it
  returns — don't trust either the code-reading or the prior report
  blindly.

**(f) Day 4 staging plan** — see the dedicated section above. Recorded as
information, not a code-verifiable item.

**(g) The design-system `.zip` in `docs/design-system/` is intentionally
untracked.** Confirmed: `git status` still shows
`docs/design-system/Grow Spark Workspace — Design System.zip` as untracked
after every commit since package 1.6. Its contents were extracted
alongside it and *those* extracted files are committed and are the actual
source of truth; the zip itself is redundant and was deliberately left out
to avoid committing a binary alongside its own unpacked contents. No
action needed unless the user asks for it to be removed from disk too.
