"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROLES, type AuditEventResponse } from "@growspark/shared";
import { useMe } from "@/hooks/use-me";
import { useAuditEventsList } from "@/hooks/use-audit-events";
import { useUserOptions } from "@/hooks/use-user-options";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListUrlState } from "@/hooks/use-list-url-state";
import { formatDate, formatTime } from "@/lib/format";
import { auditActionLabel, auditEntityHref, shortId } from "@/lib/audit-presentation";

const ANY = "ANY";

export function AuditLogPageClient() {
  const router = useRouter();
  const { data: meData, isLoading: meLoading } = useMe();
  const me = meData?.data;

  // The real control is the API (GET /audit-events requires audit:read,
  // which Staff doesn't have) — this redirect is only so Staff don't see a
  // broken page if they land here directly. Same pattern as
  // UsersPageClient/ApiKeysPageClient.
  useEffect(() => {
    if (!meLoading && me && me.user.role !== ROLES.ADMIN) {
      router.replace("/forbidden");
    }
  }, [meLoading, me, router]);

  const { searchParams, page, pageSize, setParams } = useListUrlState();
  const action = searchParams.get("action") ?? "";
  const entityType = searchParams.get("entityType") ?? "";
  const actorId = searchParams.get("actorId") ?? undefined;
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const listQuery = useAuditEventsList({
    page,
    pageSize,
    action: action || undefined,
    entityType: entityType || undefined,
    actorId,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
  });
  const { data: userOptions } = useUserOptions();
  const actors = userOptions?.data ?? [];
  const actorNames = new Map(actors.map((u) => [u.id, u.name]));

  if (meLoading || !me || me.user.role !== ROLES.ADMIN) {
    return null;
  }

  const columns: DataTableColumn<AuditEventResponse>[] = [
    {
      key: "createdAt",
      header: "When",
      render: (event) => (
        <span className="whitespace-nowrap text-ink-muted">
          {formatDate(event.createdAt)} {formatTime(event.createdAt)}
        </span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (event) => (event.actorId ? (actorNames.get(event.actorId) ?? shortId(event.actorId)) : "System"),
    },
    {
      key: "action",
      header: "Action",
      render: (event) => auditActionLabel(event.action),
    },
    {
      key: "entity",
      header: "Record",
      render: (event) => {
        const href = auditEntityHref(event.entityType, event.entityId);
        const label = `${event.entityType} ${shortId(event.entityId)}`;
        return href ? (
          <Link href={href} className="text-primary hover:underline">
            {label}
          </Link>
        ) : (
          <span className="text-ink-muted">{label}</span>
        );
      },
    },
    {
      key: "metadata",
      header: "Details",
      render: (event) =>
        event.metadata ? (
          <span className="font-mono text-xs text-ink-muted">
            {Object.entries(event.metadata as Record<string, unknown>)
              .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
              .join(" · ")}
          </span>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        rows={listQuery.data?.data ?? []}
        rowKey={(event) => event.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.meta.total ?? 0}
        onPageChange={(nextPage) => setParams({ page: nextPage })}
        emptyTitle="No audit events"
        emptyDescription="Sensitive actions (users, deactivations, archives, lead conversions, deal outcomes, API keys, and more) are recorded here as they happen."
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={action}
              onChange={(event) => setParams({ action: event.target.value || undefined })}
              placeholder="Action (e.g. user.created)"
              aria-label="Filter by action"
              className="w-56"
            />
            <Input
              value={entityType}
              onChange={(event) => setParams({ entityType: event.target.value || undefined })}
              placeholder="Entity type (e.g. lead)"
              aria-label="Filter by entity type"
              className="w-48"
            />
            <Select
              value={actorId ?? ANY}
              onValueChange={(value) => setParams({ actorId: value === ANY ? undefined : value })}
            >
              <SelectTrigger className="w-44" aria-label="Filter by actor">
                <SelectValue placeholder="Any actor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any actor</SelectItem>
                {actors.map((actor) => (
                  <SelectItem key={actor.id} value={actor.id}>
                    {actor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                aria-label="From date"
                value={from}
                onChange={(event) => setParams({ from: event.target.value || undefined })}
                className="w-36"
              />
              <span className="text-ink-muted">–</span>
              <Input
                type="date"
                aria-label="To date"
                value={to}
                onChange={(event) => setParams({ to: event.target.value || undefined })}
                className="w-36"
              />
            </div>
          </div>
        }
      />
    </div>
  );
}
