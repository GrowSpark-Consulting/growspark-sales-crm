import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";

// Every protected page authenticates by fetching /auth/me client-side
// (AuthGuard), which Cache Components' instant-navigation validation
// flags in dev by default ("Every Page and Default segment is implicitly
// validated"). This architecture is deliberately not instant — opt the
// whole protected subtree out at this one shared layout boundary rather
// than per page (users/page.tsx is a Client Component and can't carry its
// own `instant` export at all). See docs/decisions.md D28.
export const instant = false;

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
