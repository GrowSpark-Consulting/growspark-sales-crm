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
  `git push`. (Note: local commits have twice turned out to already be on
  `origin/main` anyway, pushed by something outside this tool — see
  `PROJECT-STATE.md` §7. That is not permission to push; it just means
  "local-only" isn't a safe assumption either way — check before relying
  on it.)
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

**Do not invent package content beyond what's written here.** The exact
scope of 2.1 through 2.6 has not been detailed in this repo — confirm it
with the user before assuming what each one covers. What *is* known:

- **2.0 — Day 1 leftovers first.** Close out (or at least explicitly
  re-confirm) the open items below before starting new feature work, so
  Day 2 doesn't build on top of an unresolved Day 1 question.
- **2.1–2.3 — backend.** The next backend packages, in order. Based on the
  project's own stated sales journey (leads → companies/contacts → deals),
  this almost certainly means the Company/Contact/Lead data model and
  services, but the exact package boundaries (what's in 2.1 vs. 2.2 vs.
  2.3) aren't written down — ask.
- **2.4–2.6 — UI.** The corresponding frontend work for whatever 2.1–2.3
  build. Same caveat: exact scope not detailed yet.
- **Four rules were approved on 2026-11-19 for this work** (full detail in
  `decisions.md` D29 — read the real entry before building against this
  summary):
  - Lead status: any open status → any other open status directly;
    `CONVERTED` only through the (Day 3) convert action; every change
    writes a `LeadStatusHistory` row.
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

**(a) The Cache Components "instant navigation" dev notice still appears
on `/users`, even after package 1.7's fix.** Confirmed in code:
`apps/web/app/(protected)/layout.tsx` does have `export const instant =
false;`, but `apps/web/app/(protected)/users/page.tsx` is a Client
Component (`"use client"` at the top, hooks used directly in the page) —
Next.js throws if `instant` is exported from a Client Component, so it
cannot carry its own exemption. Per the user's own browser testing, the
layout-level `false` alone is not enough to suppress the framework's
default per-Page-segment validation for a descendant page that has no
config of its own. **Planned fix, not yet implemented**: restructure
`users/page.tsx` into a thin Server Component wrapper (default export, no
`"use client"`, carrying `export const instant = false` itself) that
renders a new `"use client"` component (e.g. `UsersPageClient`) holding
today's actual logic unchanged. This is now a documented convention for
Day 2's own pages too (`PROJECT-STATE.md` §12) — build new interactive
pages this way from the start, rather than retrofitting later.

**(b) No show/hide password toggle anywhere.** Confirmed by grep: every
password field (`login-form.tsx`, `create-user-dialog.tsx`,
`reset-password-dialog.tsx`) is a plain `<Input type="password">` with no
eye icon, no `showPassword` state. Still open — a `PasswordInput`
component does not exist yet.

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
