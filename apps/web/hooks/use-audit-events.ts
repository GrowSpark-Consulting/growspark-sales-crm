import { useQuery } from "@tanstack/react-query";
import type { AuditEventResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export interface AuditEventsListParams {
  page: number;
  pageSize: number;
  action?: string;
  entityType?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export interface AuditEventsListResult {
  data: AuditEventResponse[];
  meta: { page: number; pageSize: number; total: number };
}

function buildQuery(params: AuditEventsListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page));
  searchParams.set("pageSize", String(params.pageSize));
  if (params.action) searchParams.set("action", params.action);
  if (params.entityType) searchParams.set("entityType", params.entityType);
  if (params.actorId) searchParams.set("actorId", params.actorId);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  return searchParams.toString();
}

export const AUDIT_EVENTS_QUERY_KEY_ROOT = "audit-events" as const;

export function useAuditEventsList(params: AuditEventsListParams) {
  return useQuery({
    queryKey: [AUDIT_EVENTS_QUERY_KEY_ROOT, params],
    queryFn: () => apiGet<AuditEventsListResult>(`/api/v1/audit-events?${buildQuery(params)}`),
    placeholderData: (previous) => previous,
  });
}
