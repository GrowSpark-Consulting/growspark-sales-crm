"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "cn";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MAX_PAGE_SIZE, type DealResponse, type PipelineStageResponse, type PipelineSummaryStage } from "@growspark/shared";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { DEALS_QUERY_KEY_ROOT, type DealsListResult } from "@/hooks/use-deals";
import { PIPELINE_QUERY_KEY_ROOT, usePipelineStages, usePipelineSummary } from "@/hooks/use-pipeline";
import { useUserOptions } from "@/hooks/use-user-options";
import { useCompaniesList } from "@/hooks/use-companies";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { formatDate, formatINR } from "@/lib/format";

/**
 * Fixed, simple params for every column's own deals query — no search/sort
 * choice to make, so the query key stays predictable and the move-stage
 * mutation below can target it directly for an optimistic update, the same
 * stable-key approach useDealsList's callers already rely on elsewhere.
 */
const COLUMN_SORT = "createdAt:asc";

function columnParams(stageId: string) {
  return { stageId, archived: false, pageSize: MAX_PAGE_SIZE, sort: COLUMN_SORT } as const;
}

function useColumnDeals(stageId: string) {
  const params = columnParams(stageId);
  return useQuery({
    queryKey: [DEALS_QUERY_KEY_ROOT, params],
    queryFn: () =>
      apiGet<DealsListResult>(
        `/api/v1/deals?stageId=${stageId}&archived=false&pageSize=${MAX_PAGE_SIZE}&sort=${COLUMN_SORT}&page=1`,
      ),
  });
}

/**
 * Shared by both the drag handler and every card's dropdown fallback — one
 * real mutation, POST /deals/:id/stage, with an optimistic move between the
 * two affected columns' own caches (snapshotted first, restored on error)
 * and a broad invalidation on settle so every other view (the 3.3 list,
 * the deal detail page, the pipeline summary) reconciles with the server
 * regardless of how precise the optimistic patch was.
 */
function useMoveDealMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { deal: DealResponse; toStage: PipelineStageResponse }) => {
      await apiPost(`/api/v1/deals/${vars.deal.id}/stage`, { stageId: vars.toStage.id });
    },
    onMutate: async ({ deal, toStage }) => {
      const fromKey = [DEALS_QUERY_KEY_ROOT, columnParams(deal.stageId)];
      const toKey = [DEALS_QUERY_KEY_ROOT, columnParams(toStage.id)];
      await queryClient.cancelQueries({ queryKey: fromKey });
      await queryClient.cancelQueries({ queryKey: toKey });

      const previousFrom = queryClient.getQueryData<DealsListResult>(fromKey);
      const previousTo = queryClient.getQueryData<DealsListResult>(toKey);

      if (previousFrom) {
        queryClient.setQueryData<DealsListResult>(fromKey, {
          data: previousFrom.data.filter((d) => d.id !== deal.id),
          meta: { ...previousFrom.meta, total: Math.max(0, previousFrom.meta.total - 1) },
        });
      }
      if (previousTo) {
        const moved: DealResponse = { ...deal, stageId: toStage.id, probability: toStage.probability };
        queryClient.setQueryData<DealsListResult>(toKey, {
          data: [...previousTo.data, moved],
          meta: { ...previousTo.meta, total: previousTo.meta.total + 1 },
        });
      }

      return { fromKey, toKey, previousFrom, previousTo };
    },
    onError: (error, _vars, context) => {
      if (context?.previousFrom) queryClient.setQueryData(context.fromKey, context.previousFrom);
      if (context?.previousTo) queryClient.setQueryData(context.toKey, context.previousTo);
      toast.error(error instanceof ApiError ? error.message : "Could not move this deal. Please try again.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [DEALS_QUERY_KEY_ROOT] });
      void queryClient.invalidateQueries({ queryKey: [PIPELINE_QUERY_KEY_ROOT] });
    },
  });
}

interface BoardLookups {
  ownerNames: Map<string, string>;
  companyNames: Map<string, string>;
  openStages: PipelineStageResponse[];
}

function StageDropdown({
  deal,
  openStages,
  onMove,
}: {
  deal: DealResponse;
  openStages: PipelineStageResponse[];
  onMove: (toStage: PipelineStageResponse) => void;
}) {
  const targets = openStages.filter((stage) => stage.id !== deal.stageId);
  if (targets.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between" onPointerDown={(event) => event.stopPropagation()}>
          Move to…
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {targets.map((stage) => (
          <DropdownMenuItem key={stage.id} onSelect={() => onMove(stage)}>
            {stage.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BoardCard({
  deal,
  lookups,
  isDragging,
  onMove,
}: {
  deal: DealResponse;
  lookups: BoardLookups;
  isDragging: boolean;
  onMove: (toStage: PipelineStageResponse) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deal.id, data: { deal } });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none space-y-2 rounded-md border border-line bg-surface p-3 shadow-sm",
        isDragging && "opacity-50",
      )}
    >
      <Link
        href={`/deals/${deal.id}`}
        className="body-strong block text-ink hover:underline"
        // A plain click (no drag movement) still reaches the link — the
        // PointerSensor's activation distance below is what makes this
        // safe, not this handler; kept only so a keyboard Enter on the
        // card itself (which dnd-kit also binds) doesn't also navigate.
        onKeyDown={(event) => event.stopPropagation()}
      >
        {deal.name}
      </Link>
      <p className="small text-ink-muted">{lookups.companyNames.get(deal.companyId) ?? "—"}</p>
      <p className="gs-num small">{formatINR(Number(deal.value))}</p>
      <p className="small text-ink-muted">
        {deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "No close date"} ·{" "}
        {deal.ownerId ? (lookups.ownerNames.get(deal.ownerId) ?? "—") : "Unassigned"}
      </p>
      <StageDropdown deal={deal} openStages={lookups.openStages} onMove={onMove} />
    </div>
  );
}

function BoardColumn({
  stage,
  summary,
  lookups,
  activeDealId,
  onMove,
}: {
  stage: PipelineStageResponse;
  summary: PipelineSummaryStage | undefined;
  lookups: BoardLookups;
  activeDealId: string | null;
  onMove: (deal: DealResponse, toStage: PipelineStageResponse) => void;
}) {
  const { data, isLoading, isError } = useColumnDeals(stage.id);
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const deals = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3">
      <div className="rounded-lg border border-line bg-surface p-3">
        <p className="body-strong">{stage.name}</p>
        <p className="small text-ink-muted">
          {summary
            ? `${summary.count} deal${summary.count === 1 ? "" : "s"} · ${formatINR(Number(summary.totalValue))} · weighted ${formatINR(Number(summary.weightedValue))}`
            : "…"}
        </p>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 rounded-lg border border-dashed border-line p-2 transition-colors",
          isOver && "border-primary bg-primary-soft",
        )}
      >
        {isLoading && <Skeleton className="h-20 w-full" />}
        {isError && <p className="small p-2 text-danger">Could not load this stage.</p>}
        {!isLoading && !isError && deals.length === 0 && (
          <p className="small p-4 text-center text-ink-muted">No deals</p>
        )}
        {deals.map((deal) => (
          <BoardCard
            key={deal.id}
            deal={deal}
            lookups={lookups}
            isDragging={deal.id === activeDealId}
            onMove={(toStage) => onMove(deal, toStage)}
          />
        ))}
      </div>
      {total > deals.length && (
        <Link href={`/deals?stageId=${stage.id}`} className="small text-primary hover:underline">
          Showing {deals.length} of {total} — open List view
        </Link>
      )}
    </div>
  );
}

/**
 * The 3.4 Kanban board. Columns = the pipeline's OPEN stages, in order;
 * Won/Lost deals never get a column (the roadmap: "Won/Lost deals are not
 * columns; show the open totals in a small summary bar"). Every card also
 * carries a stage dropdown — the always-present fallback — independent of
 * whether drag works in the viewer's browser or input method.
 */
export function PipelineBoard() {
  const { data: stagesData, isLoading: stagesLoading } = usePipelineStages();
  const { data: summaryData } = usePipelineSummary();
  const { data: userOptions } = useUserOptions();
  const { data: companiesData } = useCompaniesList({ pageSize: MAX_PAGE_SIZE, sort: "name:asc" });
  const [activeDeal, setActiveDeal] = useState<DealResponse | null>(null);
  const moveMutation = useMoveDealMutation();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const openStages = (stagesData?.data ?? []).filter((stage) => stage.type === "OPEN");
  const summaryByStage = new Map((summaryData?.data.stages ?? []).map((s) => [s.stageId, s]));
  const open = summaryData?.data.open;
  const lookups: BoardLookups = {
    ownerNames: new Map((userOptions?.data ?? []).map((u) => [u.id, u.name])),
    companyNames: new Map((companiesData?.data ?? []).map((c) => [c.id, c.name])),
    openStages,
  };

  function move(deal: DealResponse, toStage: PipelineStageResponse) {
    if (toStage.id === deal.stageId) return;
    setActiveDeal(null);
    moveMutation.mutate({ deal, toStage });
  }

  function handleDragStart(event: DragStartEvent) {
    const deal = event.active.data.current?.deal as DealResponse | undefined;
    setActiveDeal(deal ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;
    const toStage = openStages.find((stage) => stage.id === over.id);
    if (!toStage) return;
    const deal = active.data.current?.deal as DealResponse | undefined;
    if (!deal) return;
    move(deal, toStage);
  }

  if (stagesLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-80 w-72 shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-surface p-3 text-sm">
        <span className="body-strong">Open pipeline: </span>
        {open ? (
          <span className="text-ink-muted">
            {open.count} deal{open.count === 1 ? "" : "s"} · {formatINR(Number(open.totalValue))} total ·{" "}
            {formatINR(Number(open.weightedValue))} weighted
          </span>
        ) : (
          <span className="text-ink-muted">…</span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDeal(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-2">
          {openStages.map((stage) => (
            <BoardColumn
              key={stage.id}
              stage={stage}
              summary={summaryByStage.get(stage.id)}
              lookups={lookups}
              activeDealId={activeDeal?.id ?? null}
              onMove={move}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
