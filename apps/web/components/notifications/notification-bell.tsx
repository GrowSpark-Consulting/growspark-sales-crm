"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";

/** Shows at most "99+" so the badge never outgrows the icon. */
export function formatUnreadCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

/**
 * The app-shell header's bell: the caller's unread count, refreshed every
 * 60 seconds while the tab is visible (see useUnreadNotificationCount), and
 * a link to /notifications. A failed request simply shows no badge.
 */
export function NotificationBell() {
  const { data } = useUnreadNotificationCount();
  const unread = data?.data.unread ?? 0;
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <Button variant="ghost" size="icon" className="relative" asChild>
      <Link href="/notifications" aria-label={label} title={label}>
        <Bell aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            data-testid="notification-badge"
            className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] leading-none font-semibold text-surface"
          >
            {formatUnreadCount(unread)}
          </span>
        )}
      </Link>
    </Button>
  );
}
