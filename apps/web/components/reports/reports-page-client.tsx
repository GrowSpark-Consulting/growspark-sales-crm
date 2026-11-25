"use client";

import { Download } from "lucide-react";
import { formatRupees, type ReportKey, type ReportsData } from "@growspark/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardBarChart } from "@/components/dashboard/dashboard-bar-chart";
import { RangeScopeControls, useRangeScope } from "@/components/dashboard/range-scope-controls";
import { reportExportHref, useReports, type ReportsParams } from "@/hooks/use-reports";
import { formatDate, formatINRCompact } from "@/lib/format";
import { formatPercent, quotationStatusBadgeVariant, quotationStatusLabel } from "@/lib/quotation-presentation";

const UNASSIGNED = "Unassigned";

/**
 * /reports (D92): five predefined reports for the selected range and scope,
 * each a table (with a Total row) and, where it helps, a simple chart, plus
 * its own CSV download. Every number is the server's — this page only
 * formats it (amounts through the shared exact-decimal formatter).
 */
export function ReportsPageClient() {
  const rangeScope = useRangeScope();
  const params: ReportsParams = { from: rangeScope.from, to: rangeScope.to, scope: rangeScope.scope };
  const reports = useReports(params);
  const data = reports.data?.data;

  return (
    <div className="space-y-5">
      <RangeScopeControls state={rangeScope} idPrefix="reports" scopeLabel="Reports scope" />

      {reports.isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-full" />
          ))}
        </div>
      )}

      {reports.isError && (
        <div>
          <Alert variant="destructive">
            <AlertDescription>Could not load the reports.</AlertDescription>
          </Alert>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void reports.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {!reports.isLoading && !reports.isError && data && <ReportsContent data={data} params={params} />}
    </div>
  );
}

function ReportSection({
  title,
  description,
  report,
  params,
  children,
}: {
  title: string;
  description: string;
  report: ReportKey;
  params: ReportsParams;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface p-4" aria-labelledby={`report-${report}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`report-${report}`} className="h3">
            {title}
          </h2>
          <p className="small text-ink-muted">{description}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={reportExportHref(report, params)} aria-label={`Download CSV: ${title}`}>
            <Download className="size-(--icon-md)" aria-hidden="true" />
            Download CSV
          </a>
        </Button>
      </div>
      {children}
    </section>
  );
}

function ReportTable({ headers, rows, total, empty }: { headers: string[]; rows: React.ReactNode[][]; total: React.ReactNode[]; empty: string }) {
  if (rows.length === 0) return <p className="body text-ink-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead key={header} className={index > 0 ? "text-right" : undefined}>
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((cells, rowIndex) => (
            <TableRow key={rowIndex}>
              {cells.map((cell, index) => (
                <TableCell key={index} className={index > 0 ? "gs-num text-right" : undefined}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            {total.map((cell, index) => (
              <TableCell key={index} className={index > 0 ? "gs-num body-strong text-right" : "body-strong"}>
                {cell}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

const percent = (value: string) => `${formatPercent(value)}%`;

function ReportsContent({ data, params }: { data: ReportsData; params: ReportsParams }) {
  const { pipelineByStage, leadSources, salesByOwner, quotations, overdueTasks } = data;

  return (
    <>
      <p className="small text-ink-muted">
        Showing {formatDate(data.range.from)} – {formatDate(data.range.to)}
        {data.scope === "mine" ? " · only records you own or are assigned" : " · everyone in the organisation"}
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        <ReportSection
          title="Pipeline by stage"
          description="Open deals right now, by stage. Not filtered by the date range."
          report="pipeline-by-stage"
          params={params}
        >
          <DashboardBarChart
            title="Open pipeline value by stage"
            data={pipelineByStage.stages.map((stage) => ({ label: stage.name, value: Number(stage.totalValue) }))}
            valueFormatter={formatINRCompact}
            barColor="var(--data-6)"
          />
          <ReportTable
            headers={["Stage", "Open deals", "Value", "Weighted value"]}
            rows={pipelineByStage.stages.map((stage) => [stage.name, stage.count, formatRupees(stage.totalValue), formatRupees(stage.weightedValue)])}
            total={["Total", pipelineByStage.totals.count, formatRupees(pipelineByStage.totals.totalValue), formatRupees(pipelineByStage.totals.weightedValue)]}
            empty="No pipeline stages are configured."
          />
        </ReportSection>

        <ReportSection
          title="Lead sources and conversion"
          description="Leads created in the range, by source, and how many of them have been converted."
          report="lead-sources"
          params={params}
        >
          <DashboardBarChart title="Leads created by source" data={leadSources.rows.map((row) => ({ label: row.sourceName, value: row.created }))} />
          <ReportTable
            headers={["Source", "Leads created", "Converted", "Conversion rate"]}
            rows={leadSources.rows.map((row) => [row.sourceName, row.created, row.converted, percent(row.conversionRate)])}
            total={["Total", leadSources.totals.created, leadSources.totals.converted, percent(leadSources.totals.conversionRate)]}
            empty="No leads were created in this range."
          />
        </ReportSection>

        <ReportSection
          title="Sales performance by owner"
          description="Deals closed in the range, by owner: won (count and value), lost, and win rate."
          report="sales-by-owner"
          params={params}
        >
          <DashboardBarChart
            title="Won value by owner"
            data={salesByOwner.rows.map((row) => ({ label: row.ownerName ?? UNASSIGNED, value: Number(row.wonValue) }))}
            valueFormatter={formatINRCompact}
            barColor="var(--success)"
          />
          <ReportTable
            headers={["Owner", "Won", "Won value", "Lost", "Win rate"]}
            rows={salesByOwner.rows.map((row) => [row.ownerName ?? UNASSIGNED, row.wonCount, formatRupees(row.wonValue), row.lostCount, percent(row.winRate)])}
            total={["Total", salesByOwner.totals.wonCount, formatRupees(salesByOwner.totals.wonValue), salesByOwner.totals.lostCount, percent(salesByOwner.totals.winRate)]}
            empty="No deals were won or lost in this range."
          />
        </ReportSection>

        <ReportSection
          title="Quotations summary"
          description="Quotations issued in the range, by status. A sent quotation past its valid-until date counts as Expired."
          report="quotations"
          params={params}
        >
          <ReportTable
            headers={["Status", "Quotations", "Value"]}
            rows={quotations.rows.map((row) => [
              <Badge key={row.status} variant={quotationStatusBadgeVariant(row.status)}>
                {quotationStatusLabel(row.status)}
              </Badge>,
              row.count,
              formatRupees(row.value),
            ])}
            total={["Total", quotations.totals.count, formatRupees(quotations.totals.value)]}
            empty="No quotation statuses."
          />
        </ReportSection>

        <ReportSection
          title="Overdue tasks by assignee"
          description="Open tasks, calls and meetings due before today, with a due date inside the range."
          report="overdue-tasks"
          params={params}
        >
          <ReportTable
            headers={["Assignee", "Overdue", "Oldest due"]}
            rows={overdueTasks.rows.map((row) => [row.assigneeName ?? UNASSIGNED, row.count, formatDate(row.oldestDueAt)])}
            total={["Total", overdueTasks.totals.count, ""]}
            empty="Nothing overdue with a due date in this range."
          />
        </ReportSection>
      </div>
    </>
  );
}
