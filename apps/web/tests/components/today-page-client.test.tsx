import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const replaceMock = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/today",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { TodayPageClient } from "@/components/workspace/today-page-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderWithClient(element: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

const emptySection = { items: [], total: 0 };
function todayBody(overrides: Partial<Record<string, { items: unknown[]; total: number }>> = {}) {
  return {
    data: {
      tasksDueToday: emptySection, overdueTasks: emptySection, meetings: emptySection, newLeads: emptySection,
      closingDeals: emptySection, dealsWithoutActivity: emptySection, recentlyUpdatedDeals: emptySection,
      ...overrides,
    },
  };
}

describe("Today workspace page (package 4.4)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    replaceMock.mockClear();
    currentSearch = "";
  });

  it("defaults to scope=mine and renders every section with its empty state", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(todayBody())));
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TodayPageClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/today?scope=mine", expect.anything()));
    expect(await screen.findByText("Tasks due today")).toBeTruthy();
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getByText("Meetings this week")).toBeTruthy();
    expect(screen.getByText("New leads")).toBeTruthy();
    expect(screen.getByText("Deals closing soon")).toBeTruthy();
    expect(screen.getByText("Deals with no next activity")).toBeTruthy();
    expect(screen.getByText("Recently updated deals")).toBeTruthy();
    expect(screen.getByText("No tasks due today.")).toBeTruthy();
  });

  it("clicking All changes the scope and the request", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(todayBody())));
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TodayPageClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(replaceMock).toHaveBeenCalledWith("/today?scope=all");

    // Re-render as the URL would be after that navigation, to confirm the
    // scope actually reaches the request (router.replace itself is mocked
    // and does not re-render this test's static searchParams).
    currentSearch = "scope=all";
    fetchMock.mockClear();
    cleanup();
    renderWithClient(<TodayPageClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/today?scope=all", expect.anything()));
  });

  it("shows a task's row with a Complete action and completes it", async () => {
    const task = {
      id: "t-1", title: "Call the client", href: "/leads/l-1", type: "TASK", dueAt: "2026-11-21T10:00:00.000Z",
      recordType: "leads", recordId: "l-1",
    };
    let completed = false;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/complete")) {
        completed = true;
        return Promise.resolve(jsonResponse({ data: {} }));
      }
      return Promise.resolve(jsonResponse(todayBody({ tasksDueToday: completed ? emptySection : { items: [task], total: 1 } })));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TodayPageClient />);
    expect(await screen.findByText("Call the client")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add follow-up" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/activities/t-1/complete", expect.objectContaining({ method: "POST" })));
  });
});
