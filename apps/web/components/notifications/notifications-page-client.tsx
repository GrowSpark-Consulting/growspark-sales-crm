"use client";

import Link from "next/link";
import { toast } from "sonner";
import type { NotificationResponse } from "@growspark/shared";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useListUrlState } from "@/hooks/use-list-url-state";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationsList } from "@/hooks/use-notifications";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatTime } from "@/lib/format";

/**
 * /notifications: the signed-in user's own notifications, newest first.
 * Opening one marks it read; "Mark all as read" clears the bell. Titles and
 * links come from the server (built from the live record, D89) — this page
 * never composes them itself.
 */
export function NotificationsPageClient() {
  const { searchParams, page, pageSize, setParams } = useListUrlState();
  const unreadOnly = searchParams.get("unread") === "true";
  const list = useNotificationsList({ page, pageSize, unreadOnly });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unread = list.data?.meta.unread ?? 0;

  async function handleMarkAll() {
    try {
      const result = await markAllRead.mutateAsync();
      toast.success(result.data.updated === 1 ? "1 notification marked as read." : `${result.data.updated} notifications marked as read.`);
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : "Could not mark notifications as read. Please try again.");
    }
  }

  function handleMarkOne(notification: NotificationResponse) {
    markRead.mutate(notification.id, {
      onError: (cause) => toast.error(cause instanceof ApiError ? cause.message : "Could not mark this notification as read."),
    });
  }

  const columns: DataTableColumn<NotificationResponse>[] = [
    {
      key: "title",
      header: "Notification",
      render: (notification) => (
        <div className="flex items-center gap-2">
          {notification.readAt === null ? (
            <span className="size-2 shrink-0 rounded-full bg-brand-accent" aria-hidden="true" />
          ) : (
            <span className="size-2 shrink-0" aria-hidden="true" />
          )}
          <Link
            href={notification.href}
            onClick={() => {
              if (notification.readAt === null) handleMarkOne(notification);
            }}
            className={notification.readAt === null ? "body-strong text-ink hover:underline" : "text-ink-muted hover:underline"}
          >
            {notification.title}
          </Link>
          {notification.readAt === null && <span className="sr-only">(unread)</span>}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "When",
      render: (notification) => (
        <span className="gs-num whitespace-nowrap text-ink-muted">
          {formatDate(notification.createdAt)} {formatTime(notification.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (notification) =>
        notification.readAt === null ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => handleMarkOne(notification)} aria-label={`Mark "${notification.title}" as read`}>
            Mark read
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(notification) => notification.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        page={page}
        pageSize={pageSize}
        total={list.data?.meta.total ?? 0}
        onPageChange={(nextPage) => setParams({ page: nextPage })}
        emptyTitle={unreadOnly ? "No unread notifications" : "No notifications yet"}
        emptyDescription={
          unreadOnly
            ? "You're all caught up."
            : "You'll be told here when a lead or deal is assigned to you, a website enquiry arrives, a quotation you own is accepted or rejected, or one of your tasks is due."
        }
        filterBar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-md border border-line-strong p-0.5" role="group" aria-label="Show">
              <Button type="button" size="sm" variant={unreadOnly ? "ghost" : "default"} aria-pressed={!unreadOnly} onClick={() => setParams({ unread: undefined })}>
                All
              </Button>
              <Button type="button" size="sm" variant={unreadOnly ? "default" : "ghost"} aria-pressed={unreadOnly} onClick={() => setParams({ unread: "true" })}>
                Unread{unread > 0 ? ` (${unread})` : ""}
              </Button>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => void handleMarkAll()} disabled={unread === 0 || markAllRead.isPending}>
              Mark all as read
            </Button>
          </div>
        }
      />
    </div>
  );
}
