"use client";

import Link from "next/link";
import { Building2, ChevronRight, History, KeyRound, ListOrdered, Tags, UserRound, Users } from "lucide-react";
import { ROLES } from "@growspark/shared";
import { useMe } from "@/hooks/use-me";
import { Skeleton } from "@/components/ui/skeleton";

interface SettingsLink {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PERSONAL_LINKS: SettingsLink[] = [
  { href: "/settings/profile", title: "My profile", description: "Your name, email and role, and change your password.", icon: UserRound },
];

const ADMIN_LINKS: SettingsLink[] = [
  {
    href: "/settings/organization",
    title: "Organisation",
    description: "Name, address, GSTIN and contact details printed on quotations.",
    icon: Building2,
  },
  { href: "/settings/lead-sources", title: "Lead sources", description: "Add, rename, reorder or retire the sources a lead can come from.", icon: Tags },
  { href: "/settings/pipeline", title: "Pipeline stages", description: "Rename, reorder, add or remove deal stages and their probabilities.", icon: ListOrdered },
  { href: "/users", title: "Users", description: "Add people, change roles, deactivate accounts, reset passwords.", icon: Users },
  { href: "/settings/api-keys", title: "API keys", description: "Keys the website uses to send form submissions into the CRM.", icon: KeyRound },
  { href: "/settings/audit-log", title: "Audit log", description: "Who changed what, and when.", icon: History },
];

function LinkCard({ link }: { link: SettingsLink }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4 hover:bg-surface-hover"
    >
      <Icon className="mt-0.5 size-(--icon-md) shrink-0 text-ink-muted" aria-hidden="true" />
      <span className="flex-1">
        <span className="block font-medium text-ink">{link.title}</span>
        <span className="block text-sm text-ink-muted">{link.description}</span>
      </span>
      <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
    </Link>
  );
}

/** /settings — one page that links to everything configurable. Staff see only their own profile. */
export function SettingsPageClient() {
  const { data, isLoading } = useMe();
  if (isLoading || !data) return <Skeleton className="h-24 w-full" />;
  const isAdmin = data.data.user.role === ROLES.ADMIN;

  return (
    <div className="max-w-3xl space-y-6">
      <section className="space-y-3">
        <h2 className="h3">Personal</h2>
        <div className="grid gap-3">
          {PERSONAL_LINKS.map((link) => (
            <LinkCard key={link.href} link={link} />
          ))}
        </div>
      </section>
      {isAdmin && (
        <section className="space-y-3">
          <h2 className="h3">Administration</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ADMIN_LINKS.map((link) => (
              <LinkCard key={link.href} link={link} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
