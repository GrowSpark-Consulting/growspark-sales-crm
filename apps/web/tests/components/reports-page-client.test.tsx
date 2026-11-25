import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatRupees } from "@growspark/shared";

const replaceMock = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/reports",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { ReportsPageClient } from "@/components/reports/reports-page-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const reportsBody = {
  data: {
    range: { from: "2026-11-01", to: "2026-11-30" },
    scope: "all",
    pipelineByStage: {
      stages: [
        { stageId: "s1", name: "Qualification", position: 1, count: 2, totalValue: "1250000.50", weightedValue: "125000.05" },
        { stageId: "s2", name: "Proposal", position: 3, count: 0, totalValue: "0.00", weightedValue: "0.00" },
      ],
      totals: { count: 2, totalValue: "1250000.50", weightedValue: "125000.05" },
    },
    leadSources: {
      rows: [{ sourceId: "src1", sourceName: "Website", created: 4, converted: 1, conversionRate: "25.00" }],
      totals: { created: 4, converted: 1, conversionRate: "25.00" },
    },
    salesByOwner: {
      rows: [
        { ownerId: "u1", ownerName: "Priya Shah", wonCount: 2, wonValue: "300000.00", lostCount: 1, winRate: "66.67" },
        { ownerId: null, ownerName: null, wonCount: 1, wonValue: "500.00", lostCount: 0, winRate: "100.00" },
      ],
      totals: { wonCount: 3, wonValue: "300500.00", lostCount: 1, winRate: "75.00" },
    },
    quotations: {
      rows: [
        { status: "DRAFT", count: 1, value: "100.00" },
        { status: "SENT", count: 0, value: "0.00" },
        { status: "ACCEPTED", count: 2, value: "0.24" },
        { status: "REJECTED", count: 0, value: "0.00" },
        { status: "EXPIRED", count: 1, value: "50.00" },
      ],
      totals: { count: 4, value: "150.24" },
    },
    overdueTasks: {
      rows: [{ assigneeId: "u2", assigneeName: "Ravi Kumar", count: 3, oldestDueAt: "2026-11-03T06:30:00.000Z" }],
      totals: { count: 3 },
    },
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReportsPageClient />
    </QueryClientProvider>,
  );
}

function section(title: string) {
  return screen.getByRole("region", { name: title });
}

describe("Reports page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    replaceMock.mockClear();
    currentSearch = "";
  });

  it("asks for this month, all scope, and renders all five reports with the server's figures and Total rows", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(reportsBody)));
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/reports?scope=all", expect.anything()));
    expect(await screen.findByText(/Showing/)).toBeTruthy();

    const pipeline = section("Pipeline by stage");
    expect(within(pipeline).getAllByText(formatRupees("1250000.50")).length).toBeGreaterThan(0);
    expect(within(pipeline).getByText("Not filtered by the date range.", { exact: false })).toBeTruthy();

    const sources = section("Lead sources and conversion");
    expect(within(sources).getAllByText("25%").length).toBe(2);

    const sales = section("Sales performance by owner");
    expect(within(sales).getAllByText("Priya Shah").length).toBe(2); // table + the chart's screen-reader table
    expect(within(sales).getAllByText("Unassigned").length).toBeGreaterThan(0);
    expect(within(sales).getByText(formatRupees("300500.00"))).toBeTruthy();
    expect(within(sales).getByText("66.67%")).toBeTruthy();

    const quotations = section("Quotations summary");
    expect(within(quotations).getByText("₹ 0.24")).toBeTruthy();
    expect(within(quotations).getByText("₹ 150.24")).toBeTruthy();
    expect(within(quotations).getByText("Expired")).toBeTruthy();

    const overdue = section("Overdue tasks by assignee");
    expect(within(overdue).getByText("Ravi Kumar")).toBeTruthy();
    expect(within(overdue).getAllByText("Total").length).toBe(1);
  });

  it("each Download CSV link carries exactly the filters on screen", async () => {
    currentSearch = "range=custom&from=2026-10-01&to=2026-10-31&scope=mine";
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ data: { ...reportsBody.data, scope: "mine" } })));
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/reports?scope=mine&from=2026-10-01&to=2026-10-31", expect.anything()),
    );
    const expected: Record<string, string> = {
      "Pipeline by stage": "pipeline-by-stage",
      "Lead sources and conversion": "lead-sources",
      "Sales performance by owner": "sales-by-owner",
      "Quotations summary": "quotations",
      "Overdue tasks by assignee": "overdue-tasks",
    };
    for (const [title, key] of Object.entries(expected)) {
      const link = await screen.findByRole("link", { name: `Download CSV: ${title}` });
      expect(link.getAttribute("href")).toBe(`/api/v1/reports/${key}/export?scope=mine&from=2026-10-01&to=2026-10-31`);
    }
  });

  it("the Mine toggle updates the URL", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(reportsBody))));
    renderPage();
    await screen.findByText(/Showing/);
    fireEvent.click(screen.getByRole("button", { name: "Mine" }));
    expect(replaceMock).toHaveBeenCalledWith("/reports?scope=mine");
  });

  it("shows empty-state text for reports with no rows", async () => {
    const empty = {
      data: {
        ...reportsBody.data,
        leadSources: { rows: [], totals: { created: 0, converted: 0, conversionRate: "0.00" } },
        salesByOwner: { rows: [], totals: { wonCount: 0, wonValue: "0.00", lostCount: 0, winRate: "0.00" } },
        overdueTasks: { rows: [], totals: { count: 0 } },
      },
    };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(empty))));
    renderPage();
    expect(await screen.findByText("No leads were created in this range.")).toBeTruthy();
    expect(screen.getByText("No deals were won or lost in this range.")).toBeTruthy();
    expect(screen.getByText("Nothing overdue with a due date in this range.")).toBeTruthy();
  });

  it("shows an error with a retry", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "INTERNAL", message: "x" } }, 500))));
    renderPage();
    expect(await screen.findByText("Could not load the reports.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
