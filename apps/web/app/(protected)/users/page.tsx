import { UsersPageClient } from "@/components/users/users-page-client";

// Thin Server Component wrapper — the rule for every page.tsx under
// (protected): the page itself stays a Server Component so it can carry its
// own `instant` route-segment config (Next.js throws if `instant` is
// exported from a Client Component), while the actual interactive logic
// lives in a separate "use client" component it renders. See D31 /
// PROJECT-STATE §12.
export const instant = false;

export default function UsersPage() {
  return <UsersPageClient />;
}
