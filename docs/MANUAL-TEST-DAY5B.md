# Manual test script — Day 5b (CSV export, Docker, RBAC sweep)

Written for someone who has never used this app before. This environment
has no browser-automation tool, so none of this has been run by the person
who wrote it — if a step doesn't match reality, that's a real bug to
report, not a typo in this script.

Do not check any box below until it has actually been clicked through or
run in a real terminal.

## 0. Before you start

- [ ] Confirm `pnpm typecheck && pnpm lint && pnpm test` passes from a
      clean state (584 tests expected: 483 `apps/api`, 101 `apps/web`).
- [ ] Start native dev: `pnpm dev` from the repo root, sign in as Admin at
      `http://localhost:3000`.

## 1. CSV export — Leads, Companies, Contacts, Deals

> **Known Excel gotcha, now fixed — worth knowing even though it shouldn't
> happen again.** Excel on Windows has a real, long-standing bug: if a
> CSV's very first cell is the bare two letters "ID", Excel guesses the
> file is an old SYLK spreadsheet and refuses to open it ("Excel has
> detected that the file is a SYLK file, but cannot load it"), even though
> the file is perfectly valid CSV. Found in manual testing of this exact
> feature. Fixed by renaming each export's first column ("Lead ID",
> "Company ID", "Contact ID", "Deal ID" — never the bare word "ID") and by
> writing every export with a UTF-8 byte-order mark up front. See
> `docs/decisions.md` D82. If this script's step 1 below ever fails to
> open in Excel again, this is the first thing to check.

1. [ ] Open **Leads**. Apply any filter (e.g. Status = Qualified). Click
       **Download CSV**. **Expected**: a file named
       `leads-export-<today's date>.csv` downloads **and actually opens in
       Excel** (not just a text editor) with readable column headers
       (**Lead ID**, First name, Last name, Email, ... Source, Owner, ...)
       and the Source/Owner columns show real names, not UUIDs. Rupee signs
       or accented characters, if any appear, should display correctly, not
       as `?` or mojibake.
2. [ ] Repeat for **Companies**, **Contacts**, and **Deals** — each has its
       own **Download CSV** button with the same behaviour (first column
       "Company ID"/"Contact ID"/"Deal ID" respectively; Deals' export
       shows the Company and Stage by name).
3. [ ] If you have (or create) a record whose name contains a comma or a
       quote mark, confirm it opens back up correctly in Excel/Sheets as
       one cell, not split across columns.
4. [ ] Sign in as **Staff** and confirm Download CSV still works on every
       one of the four lists (export is not Admin-only).

## 2. Docker — the whole stack in one command

1. [ ] Make sure nothing else is using ports 3100/4100 (your native
       `pnpm dev` on 3000/4000 can keep running — that's the point).
2. [ ] From the repo root: `docker compose --profile full up --build -d`.
       First run takes a few minutes (downloads + builds both images);
       later runs are much faster unless you've edited something.
3. [ ] Open `http://localhost:3100`. **Expected**: the login page loads.
4. [ ] Sign in with **admin@growspark.test** / **dev-only-admin-password**.
       **Expected**: you land on a dashboard showing all zeros/empty —
       this is a brand-new, empty database (`crm_docker`), not your native
       `crm_dev` data. If you see your own real leads/companies here,
       **stop and report it** — that would mean the isolation has
       regressed.
5. [ ] Click around — Leads, Companies, Deals should all be empty lists
       with working "Add" buttons. Create one throwaway lead to confirm
       writes work.
6. [ ] Run `pnpm docker:check-env-leak` from the repo root — works directly
       in Windows `cmd`/PowerShell now (it's a plain Node script,
       `scripts/check-dockerignore.mjs`; it used to need a POSIX `sh`,
       which Windows doesn't have by default). **Expected**: prints `OK: no
       real .env-style file is present in the Docker build context.`
7. [ ] Optional: `docker compose --profile full exec api pnpm db:seed:sample -- --confirm`
       for richer fictional demo data, then refresh the dashboard.
8. [ ] `docker compose --profile full down`. Then confirm your native
       `pnpm dev` session (still running on 3000/4000, untouched) still
       shows all of your real data exactly as before — nothing from the
       Docker run should have leaked back into it.

## 3. Audit log (Admin only)

1. [ ] As **Admin**, click **Audit Log** in the sidebar (bottom Admin-only
       section, after Users and API Keys). URL:
       `http://localhost:3000/settings/audit-log`.
2. [ ] **Expected**: a table of audit events, newest first, with columns
       When / Actor / Action / Record / Details. If you've been clicking
       around this session, you should already see rows like
       `User created`, `Lead converted`, `Deal won`, etc.
3. [ ] Confirm the **Details** column never shows anything that looks like
       a raw API key (`gsk_live_...`), a password hash (starts
       `$argon2id$`), or a session token — only short, readable fields
       (names, ids, changed-field lists, old/new values).
4. [ ] Try each filter: type an action (e.g. `lead.created`) in **Action**,
       an entity type (e.g. `lead`) in **Entity type**, pick a specific
       person from the **Actor** dropdown, and set a date range. Confirm
       the table narrows down each time and the page number resets to 1.
5. [ ] Click a **Record** link for a row whose entity type is lead/company/
       contact/deal/enquiry (website submission) — confirm it takes you to
       that actual record's detail page.
6. [ ] As **Staff**, confirm there is no **Audit Log** entry in the sidebar
       at all, and that navigating directly to
       `http://localhost:3000/settings/audit-log` redirects to the 403
       page.

## 4. RBAC spot-check (full sweep already done by code inspection + the
   automated route-registry test; this is a human sanity check of a few
   representative screens)

1. [ ] As **Staff**, confirm the sidebar has no **Users**, **API Keys**, or
       **Audit Log** entry, and that navigating directly to
       `http://localhost:3000/users`, `/settings/api-keys`, or
       `/settings/audit-log` redirects to the 403 page.
2. [ ] As **Admin**, confirm all three of those screens work normally.

## 5. Regression

- [ ] `pnpm typecheck && pnpm lint && pnpm test` still passes after
      everything above (native dev only — do not point this at `crm_docker`).
