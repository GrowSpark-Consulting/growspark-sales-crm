"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { Home, Users as UsersIcon, Building2, Contact, Target, Handshake, Sun, Moon, Monitor, LogOut } from "lucide-react";
import { cn } from "cn";
import { useMe, ME_QUERY_KEY } from "@/hooks/use-me";
import { apiPost, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// docs/design-system/README.md §5: only 3 routes exist today, so a flat
// lookup is fine. Revisit (derive from the route tree) once more pages land.
const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/users": "Users",
  "/forbidden": "Forbidden",
  "/leads": "Leads",
  "/companies": "Companies",
  "/contacts": "Contacts",
  "/deals": "Deals",
};

// Falls back to a prefix match (so /companies/:id also shows "Companies")
// once more than the flat lookup's exact routes exist — still revisit with
// a real route-tree-derived title once the page count grows further
// (noted in package 1.6, D27).
function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const prefixMatch = Object.entries(PAGE_TITLES).find(
    ([path]) => path !== "/" && pathname.startsWith(`${path}/`)
  );
  return prefixMatch?.[1] ?? "Grow Spark CRM";
}

function NavItem({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-(--control-md) items-center gap-3 rounded-md px-2 text-sm text-sidebar-foreground",
        active ? "bg-sidebar-active font-medium" : "hover:bg-sidebar-active"
      )}
    >
      <Icon className="size-(--icon-md) opacity-85" />
      {children}
    </Link>
  );
}

function initials(name: string | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "")).toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data } = useMe();
  const me = data?.data;
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

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
      <aside className="flex w-(--sidebar-width) shrink-0 flex-col bg-sidebar px-3 py-4">
        <div className="mb-5 flex items-center gap-2 px-2 text-[15px] font-semibold text-sidebar-foreground">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-product-sales text-[13px] font-semibold text-surface">
            S
          </span>
          Sales &amp; CRM
        </div>
        <nav className="flex flex-col gap-1">
          <NavItem href="/" active={pathname === "/"} icon={Home}>
            Home
          </NavItem>
          <NavItem href="/leads" active={pathname.startsWith("/leads")} icon={Target}>
            Leads
          </NavItem>
          <NavItem href="/companies" active={pathname.startsWith("/companies")} icon={Building2}>
            Companies
          </NavItem>
          <NavItem href="/contacts" active={pathname.startsWith("/contacts")} icon={Contact}>
            Contacts
          </NavItem>
          <NavItem href="/deals" active={pathname.startsWith("/deals")} icon={Handshake}>
            Deals
          </NavItem>
          {isAdmin && (
            <NavItem href="/users" active={pathname.startsWith("/users")} icon={UsersIcon}>
              Users
            </NavItem>
          )}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-(--topbar-height) shrink-0 items-center justify-between border-b border-line bg-surface px-6">
          <h1 className="h1">{pageTitle(pathname)}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs font-semibold text-ink">
                  {initials(me?.user.name)}
                </span>
                <span className="hidden text-sm font-medium sm:inline">{me?.user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal text-ink-muted">{me?.user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">
                  <Sun className="size-4" />
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon className="size-4" />
                  Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor className="size-4" />
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
