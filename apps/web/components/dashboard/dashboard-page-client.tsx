"use client";

import Link from "next/link";
import { LEAD_STATUSES } from "@growspark/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatCard } from "@/components/ui/stat-card";
import { DashboardBarChart } from "@/components/dashboard/dashboard-bar-chart";
import { useDashboard } from "@/hooks/use-dashboard";
import { RangeScopeControls, useRangeScope } from "@/components/dashboard/range-scope-controls";
import { formatDate, formatINRCompact, formatTime } from "@/lib/format";
import { leadStatusChartColor, leadStatusLabel } from "@/lib/lead-presentation";
import { activityRecordHref, activityTypeLabel } from "@/lib/activity-presentation";

function monthLabel(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(
    new Date(year!, (monthIndex ?? 1) - 1, 1),
  );
}

export function DashboardPageClient() {
  const rangeScope = useRangeScope();
  const { from, to, scope } = rangeScope;

  const dashboard = useDashboard({ from, to, scope });
  const data = dashboard.data?.data;

  return (
    <div className="space-y-5">
      <RangeScopeControls state={rangeScope} idPrefix="dashboard" scopeLabel="Dashboard scope" />

      {dashboard.isLoading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      )}

      {dashboard.isError && (
        <div>
          <Alert variant="destructive">
            <AlertDescription>Could not load the dashboard.</AlertDescription>
          </Alert>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void dashboard.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {!dashboard.isLoading && !dashboard.isError && data && <DashboardContent data={data} />}
    </div>
  );
}

function DashboardContent({ data }: { data: NonNullable<ReturnType<typeof useDashboard>["data"]>["data"] }) {
  const { metrics } = data;
  const kpis: { label: string; value: string }[] = [
    { label: "Leads created", value: String(metrics.leadsCreated) },
    { label: "Qualified leads", value: String(metrics.qualifiedLeads) },
    { label: "Active leads", value: String(metrics.activeLeads) },
    { label: "Open deals", value: String(metrics.openDeals.count) },
    { label: "Open pipeline value", value: formatINRCompact(Number(metrics.openDeals.value)) },
    { label: "Weighted value", value: formatINRCompact(Number(metrics.openDeals.weightedValue)) },
    { label: "Won revenue", value: formatINRCompact(Number(metrics.wonRevenue)) },
    { label: "Win rate", value: `${metrics.winRate}%` },
    { label: "Overdue tasks", value: String(metrics.overdueActivities) },
  ];

  const leadsBySource = data.leadsBySource.map((row) => ({ label: row.sourceName, value: row.count }));
  const leadsByStatus = LEAD_STATUSES.map((status) => ({
    label: leadStatusLabel(status),
    value: data.leadsByStatus.find((row) => row.status === status)?.count ?? 0,
    color: leadStatusChartColor(status),
  }));
  const pipelineByStage = data.pipelineByStage.stages
    .filter((stage) => stage.type === "OPEN")
    .map((stage) => ({ label: stage.name, value: Number(stage.totalValue) }));
  const monthlyWonRevenue = data.monthlyWonRevenue.map((row) => ({ label: monthLabel(row.month), value: Number(row.value) }));

  return (
    <>
      <p className="small text-ink-muted">
        Showing {formatDate(data.range.from)} – {formatDate(data.range.to)}
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardBarChart title="Leads by source" data={leadsBySource} />
        <DashboardBarChart title="Leads by status" data={leadsByStatus} />
        <DashboardBarChart title="Pipeline by stage" data={pipelineByStage} valueFormatter={formatINRCompact} barColor="var(--data-6)" />
        <DashboardBarChart
          title="Monthly won revenue"
          data={monthlyWonRevenue}
          valueFormatter={formatINRCompact}
          barColor="var(--success)"
        />
      </div>

      <section className="rounded-lg border border-line bg-surface p-4" aria-label="Recent activity">
        <h2 className="h3 mb-3">Recent activity</h2>
        {data.recentActivity.length === 0 ? (
          <p className="body text-ink-muted">No recent activity.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.recentActivity.map((activity) => {
              const href = activityRecordHref(activity);
              return (
                <li key={activity.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    {href ? (
                      <Link href={href} className="body-strong text-ink hover:underline">
                        {activity.subject}
                      </Link>
                    ) : (
                      <span className="body-strong">{activity.subject}</span>
                    )}
                    <p className="small text-ink-muted">
                      {activityTypeLabel(activity.type)} · {formatDate(activity.createdAt)} · {formatTime(activity.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
