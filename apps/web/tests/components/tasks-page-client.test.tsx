import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const replaceMock = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/tasks",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { TasksPageClient } from "@/components/tasks/tasks-page-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderWithClient(element: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

function emptyList(_input: RequestInfo | URL) {
  void _input;
  return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 25, total: 0 } }));
}

describe("My Tasks page (package 4.4)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    replaceMock.mockClear();
    currentSearch = "";
  });

  it("defaults to the Open tab and requests open, non-overdue activities sorted by due date", async () => {
    const fetchMock = vi.fn(emptyList);
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TasksPageClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("status=OPEN");
    expect(url).toContain("sort=dueAt%3Aasc");
    expect(url).not.toContain("overdue=true");
    expect(await screen.findByText("You're all caught up")).toBeTruthy();
  });

  it("clicking the Overdue tab updates the URL to status=OPEN&overdue=true", async () => {
    const fetchMock = vi.fn(emptyList);
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TasksPageClient />);
    // Radix's Tabs.Trigger activates on mousedown (and focus/keyboard), not
    // a synthetic click event — jsdom needs the specific event it listens for.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Overdue" }));
    // jsdom's mousedown also triggers a focus event, and Radix's Tabs.Trigger
    // calls onValueChange from both handlers — both carry the same value, so
    // only the most recent call matters here.
    expect(replaceMock).toHaveBeenCalled();
    const nextUrl = replaceMock.mock.calls.at(-1)![0] as string;
    expect(nextUrl).toContain("status=OPEN");
    expect(nextUrl).toContain("overdue=true");
  });

  it("clicking the Done tab requests status=DONE with no overdue param", async () => {
    const fetchMock = vi.fn(emptyList);
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TasksPageClient />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Done" }));
    const nextUrl = replaceMock.mock.calls.at(-1)![0] as string;
    expect(nextUrl).toContain("status=DONE");
    expect(nextUrl).not.toContain("overdue");
  });

  it("reads the overdue tab, and type/priority filters, back out of the URL", async () => {
    currentSearch = "overdue=true&type=CALL&priority=HIGH";
    const fetchMock = vi.fn(emptyList);
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TasksPageClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("overdue=true");
    expect(url).toContain("type=CALL");
    expect(url).toContain("priority=HIGH");
    expect(screen.getByRole("tab", { name: "Overdue" }).getAttribute("data-state")).toBe("active");
  });

  it("completes an open task from the list", async () => {
    let completed = false;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/complete")) {
        completed = true;
        return Promise.resolve(jsonResponse({ data: {} }));
      }
      return Promise.resolve(jsonResponse({
        data: completed ? [] : [{
          id: "a-1", type: "TASK", subject: "Call the client", description: null, status: "OPEN", priority: "MEDIUM",
          dueAt: "2026-11-21T10:00:00.000Z", startAt: null, endAt: null, reminderAt: null, completedAt: null,
          assigneeId: null, createdById: "u-1", leadId: "l-1", contactId: null, companyId: null, dealId: null,
          createdAt: "2026-11-20T00:00:00.000Z", updatedAt: "2026-11-20T00:00:00.000Z",
        }],
        meta: { page: 1, pageSize: 25, total: completed ? 0 : 1 },
      }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TasksPageClient />);
    fireEvent.click(await screen.findByRole("button", { name: "Complete" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/activities/a-1/complete", expect.objectContaining({ method: "POST" })));
  });
});
