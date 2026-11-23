import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const replaceMock = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderWithClient(element: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

function stubFetch(body: unknown) {
  const fetchMock = vi.fn((_input: RequestInfo | URL) => {
    void _input;
    return Promise.resolve(jsonResponse(body));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function dashboardBody(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      range: { from: "2026-11-01", to: "2026-11-30" },
      scope: "all",
      metrics: {
        leadsCreated: 5,
        newLeads: 2,
        qualifiedLeads: 3,
        activeLeads: 4,
        leadConversionRate: "20.00",
        openDeals: { count: 2, value: "150000.00", weightedValue: "50000.00" },
        wonDeals: 1,
        lostDeals: 0,
        wonRevenue: "80000.00",
        winRate: "100.00",
        overdueActivities: 7,
      },
      leadsBySource: [{ sourceId: "s-1", sourceName: "Website", count: 3 }],
      leadsByStatus: [{ status: "NEW", count: 2 }],
      pipelineByStage: {
        stages: [{ stageId: "st-1", name: "Qualification", position: 1, type: "OPEN", count: 2, totalValue: "150000.00", weightedValue: "50000.00" }],
        open: { count: 2, totalValue: "150000.00", weightedValue: "50000.00" },
      },
      monthlyWonRevenue: [{ month: "2026-11", value: "80000.00" }],
      recentActivity: [{
        id: "a-1", type: "TASK", subject: "Call the client", description: null, status: "DONE", priority: "MEDIUM",
        dueAt: null, startAt: null, endAt: null, reminderAt: null, completedAt: "2026-11-20T10:00:00.000Z",
        assigneeId: null, createdById: "u-1", leadId: "l-1", contactId: null, companyId: null, dealId: null,
        createdAt: "2026-11-20T09:00:00.000Z", updatedAt: "2026-11-20T10:00:00.000Z",
      }],
      ...overrides,
    },
  };
}

function emptyDashboardBody() {
  return dashboardBody({
    metrics: {
      leadsCreated: 0, newLeads: 0, qualifiedLeads: 0, activeLeads: 0, leadConversionRate: "0.00",
      openDeals: { count: 0, value: "0.00", weightedValue: "0.00" }, wonDeals: 0, lostDeals: 0,
      wonRevenue: "0.00", winRate: "0.00", overdueActivities: 0,
    },
    leadsBySource: [], leadsByStatus: [],
    pipelineByStage: { stages: [], open: { count: 0, totalValue: "0.00", weightedValue: "0.00" } },
    monthlyWonRevenue: [], recentActivity: [],
  });
}

function statValue(label: string): string | null | undefined {
  return screen.getByText(label).nextElementSibling?.textContent;
}

function chartTableText(title: string): string {
  const figure = screen.getByRole("figure", { name: title });
  return figure.querySelector("table")?.textContent ?? "";
}

describe("Home dashboard (package 4.5)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    replaceMock.mockClear();
    currentSearch = "";
  });

  it("renders every KPI value straight from the response", async () => {
    const fetchMock = stubFetch(dashboardBody());
    renderWithClient(<DashboardPageClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(await screen.findByText("Leads created")).toBeTruthy();
    expect(statValue("Leads created")).toBe("5");
    expect(statValue("Qualified leads")).toBe("3");
    expect(statValue("Active leads")).toBe("4");
    expect(statValue("Open deals")).toBe("2");
    expect(statValue("Win rate")).toBe("100.00%");
    expect(statValue("Overdue tasks")).toBe("7");
    expect(chartTableText("Leads by source")).toContain("Website");
    expect(chartTableText("Pipeline by stage")).toContain("Qualification");
    expect(screen.getByText("Call the client")).toBeTruthy();
  });

  it("shows an empty state on every chart for an empty range, with zeroed KPIs", async () => {
    stubFetch(emptyDashboardBody());
    renderWithClient(<DashboardPageClient />);
    await screen.findByText("Leads created");
    expect(statValue("Leads created")).toBe("0");
    expect(screen.getAllByText("No data for this range.").length).toBeGreaterThan(0);
    expect(screen.getByText("No recent activity.")).toBeTruthy();
  });

  it("defaults to scope=all, and clicking Mine updates the URL", async () => {
    const fetchMock = stubFetch(dashboardBody());
    renderWithClient(<DashboardPageClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const firstUrl = String(fetchMock.mock.calls[0]![0]);
    expect(firstUrl).toContain("scope=all");
    fireEvent.click(screen.getByRole("button", { name: "Mine" }));
    expect(replaceMock).toHaveBeenCalledWith("/?scope=mine");
  });

  it("the Last 30 days range requests a 30-day from/to window", async () => {
    currentSearch = "range=30d";
    const fetchMock = stubFetch(dashboardBody());
    renderWithClient(<DashboardPageClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = new URL(String(fetchMock.mock.calls[0]![0]), "http://localhost");
    const from = url.searchParams.get("from")!;
    const to = url.searchParams.get("to")!;
    const days = (Date.parse(to) - Date.parse(from)) / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(30, 0);
  });
});
