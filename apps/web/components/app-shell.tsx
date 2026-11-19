"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe, ME_QUERY_KEY } from "@/hooks/use-me";
import { apiPost, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data } = useMe();
  const me = data?.data;
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isAdmin = me?.user.role === "ADMIN";

  async function handleLogout() {
    try {
      await apiPost("/api/v1/auth/logout");
    } catch (err) {
      // Logging out should still clear local state and navigate even if the
      // server call fails (e.g. the session was already gone) — but a
      // genuinely unexpected failure is still worth telling the user about.
      if (!(err instanceof ApiError)) {
        toast.error("Logout did not complete cleanly, but you have been signed out here.");
      }
    } finally {
      queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
      router.replace("/login");
    }
  }

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r p-4">
        <div className="mb-4 px-3 text-sm font-semibold">Grow Spark CRM</div>
        <nav className="flex flex-col gap-1">
          <NavLink href="/" active={pathname === "/"}>
            Home
          </NavLink>
          {isAdmin && (
            <NavLink href="/users" active={pathname.startsWith("/users")}>
              Users
            </NavLink>
          )}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end border-b px-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                {me ? `${me.user.name} (${me.user.role})` : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                {me?.user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout}>Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
