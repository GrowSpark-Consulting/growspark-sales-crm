# Manual test script — Day 1 (packages 1.1–1.5)

Run this in a real browser once `pnpm dev` is up (`http://localhost:3000`).
Everything here has already passed through automated tests (124 passing in
`apps/api`) and `pnpm build`; this is about the parts only a browser can
show — real rendering, real clicks, real redirects.

**Credentials**: the seeded accounts are `admin@growspark.test` and
`staff@growspark.test`. Their passwords are whatever you set
`SEED_ADMIN_PASSWORD` / `SEED_STAFF_PASSWORD` to in `apps/api/.env` before
running `pnpm db:seed` — check that file if you don't remember them.

Tick each box as you go. If anything doesn't match what's described, stop
and flag it rather than ticking it.

## 0. Before you start

- [ ] `pnpm dev` is running (three processes: `packages/shared`, `apps/api`,
      `apps/web` — all three should print startup output, not just two)
- [ ] `http://localhost:4000/health` returns `{"status":"ok",...}` in a new
      tab (confirms the API is actually up, independent of the web app)

## 1. Unauthenticated access

- [ ] Open `http://localhost:3000/` in a fresh/incognito window (no
      existing session). Briefly see a loading skeleton, then land on
      `/login` automatically — the address bar should show
      `/login?next=%2F`
- [ ] Open `http://localhost:3000/users` directly, same fresh session.
      Same redirect, but to `/login?next=%2Fusers`

## 2. Logging in — wrong password, then correct (as Admin)

- [ ] On the login page, enter `admin@growspark.test` with an obviously
      wrong password. Submit. See a generic error message near the top of
      the form (something like "Invalid email or password") — it must
      **not** say anything that reveals whether the email exists
- [ ] Clear the password field, enter the correct Admin password. Submit.
      You should land on `/` (the Home page), not stay on `/login`
- [ ] The Home page shows a plain "Welcome to Grow Spark Sales & CRM"
      message — no dashboard yet, that's expected (it comes in a later
      package)

## 3. Navigation and shell (as Admin)

- [ ] The sidebar shows **both** "Home" and "Users" links
- [ ] The top-right corner shows your name and role (e.g. "Demo Admin
      (ADMIN)"). Clicking it opens a menu showing your email and a "Log
      out" item
- [ ] Click "Users" in the sidebar. You land on `/users` and see a table
      with at least the two seeded users (Demo Admin, Demo Staff)

## 4. Users page — as Admin

- [ ] Click "New user". A dialog opens asking for name, email, role,
      initial password
- [ ] Try submitting with a password under 10 characters. See a field-level
      error under the password field (not just a generic banner) — the
      dialog should **not** close
- [ ] Fill in a valid new Staff user (any email not already used, a real
      name, role Staff, a password 10+ characters) and submit. The dialog
      closes, a success toast appears, and the new user appears in the
      table
- [ ] Try creating another user with the **same email** you just used.
      Expect an inline error banner in the dialog (not a silent failure, not
      a crash) — something indicating the email is already in use
- [ ] Find your new user's row. Click "Edit". Change the name, save. The
      table updates to show the new name and a success toast appears
- [ ] In the same Edit dialog (or a fresh one), change the role from Staff
      to Admin, save. The row's Role column updates to ADMIN
- [ ] Click "Reset password" on that same user. Enter a new password 10+
      characters, submit. See a success toast mentioning they've been
      signed out everywhere (they have no active session yet in this test,
      but the message should still appear)
- [ ] Click "Deactivate" on that user. A confirmation dialog appears before
      anything happens — cancel it once to confirm it doesn't deactivate
      immediately, then open it again and confirm. The row's status badge
      changes to "Inactive", and the button for that row now says
      "Reactivate" instead of "Deactivate"
- [ ] Click "Reactivate" on that same row (with its own confirmation).
      Status goes back to "Active"

## 5. The last-Admin rule (as Admin)

This needs there to be only **one** active Admin in the organisation —
which is the seeded default (`Demo Admin`). If you created a second Admin
in step 4, deactivate or demote it back to Staff first so only one Admin
remains active before continuing.

- [ ] Try to edit **Demo Admin** (the account you're signed in as) and
      change its role to Staff. Expect an inline error in the dialog —
      something like "This would leave the organisation with no active
      Admin" — and the role must **not** actually change (refresh the page
      if you want to double-check the table)
- [ ] Try to **deactivate** Demo Admin. Same expectation: an inline error,
      no actual change

## 6. Filters, search, pagination (as Admin)

- [ ] Type part of a user's name or email into the search box and press
      Enter (or click Search). The table narrows to matching rows only
- [ ] Clear the search. Use the role filter to show only Staff, then only
      Admin, then "All roles" again — the table updates each time
- [ ] Use the status filter the same way (Active / Inactive / Any status)
- [ ] If you have more than 10 users total, the pagination controls at the
      bottom ("Page X of Y") become usable — Previous/Next move between
      pages. With 10 or fewer, Next should be disabled

## 7. Logging out, then back in as Staff

- [ ] Open the user menu (top right) and click "Log out". You land on
      `/login`
- [ ] Try pressing the browser's Back button. You should **not** see any
      cached protected page content — you should still be looking at
      `/login` (or get redirected straight back to it)
- [ ] Sign in as `staff@growspark.test` with the correct Staff password

## 8. Navigation and restrictions — as Staff

- [ ] The sidebar shows **only** "Home" — no "Users" link
- [ ] Manually type `http://localhost:3000/users` into the address bar
      while signed in as Staff. You should land on a "403 — Forbidden"
      page, not the real Users table and not a broken/blank page
- [ ] Open the user menu. It shows your Staff name/role/email and a working
      "Log out" — Staff gets the same shell chrome, just fewer links

## 9. Signed-in users visiting `/login`

- [ ] While still signed in as Staff, manually navigate to
      `http://localhost:3000/login`. You should be redirected straight to
      `/` (Home), not shown the login form again

## 10. Session ends immediately on deactivation

This one needs two browser windows (or a normal window + an incognito one)
signed in as two different people at the same time.

- [ ] Window A: sign in as Admin.
- [ ] Window B: sign in as Staff (the seeded `staff@growspark.test`
      account, or another Staff user you don't mind deactivating).
- [ ] In Window A, go to Users and deactivate the account that's signed in
      in Window B.
- [ ] In Window B, without refreshing, click any link in the sidebar (e.g.
      "Home" then back). The next request should fail its session check and
      bounce you to `/login` — you should **not** be able to keep using the
      app as that now-deactivated user.
- [ ] Reactivate that account from Window A afterwards if you want to keep
      using it (the seeded Staff account shouldn't stay deactivated for
      other testing).

## 11. Toasts for unexpected errors

This is harder to trigger deliberately since it's meant for true server
errors (500s), not the validation/conflict cases above, which show inline.
If you happen to see one during any of the above (e.g. from stopping the
API mid-request), check:

- [ ] It appears as a toast (top-right-ish notification), not a page crash
- [ ] It includes something you could hand to the person investigating (a
      "Request ID: ..." line) rather than just a bare "error" message

---

If everything above checked out, Day 1 (packages 1.1 through 1.5) is
functionally complete end to end: auth, permissions, user management, the
last-Admin rule, and audit logging all work through a real browser, not
just the automated test suite.
