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

const ME_ID = "11111111-1111-4111-8111-111111111111";
const ASHA_ID = "22222222-2222-4222-8222-222222222222";

/**
 * D100: the page needs the signed-in user (/auth/me) and the user list
 * (/users/options) as well as the activities themselves.
 */
function answer(input: RequestInfo | URL, activities: unknown[] = []) {
  const url = String(input);
  if (url.includes("/auth/me")) {
    return Promise.resolve(jsonResponse({ data: { user: { id: ME_ID, email: "me@example.test", name: "Test Me", role: "STAFF" }, organization: { name: "Org" } } }));
  }
  if (url.includes("/users/options")) {
    return Promise.resolve(jsonResponse({ data: [{ id: ME_ID, name: "Test Me" }, { id: ASHA_ID, name: "Asha Rao" }] }));
  }
  return Promise.resolve(jsonResponse({ data: activities, meta: { page: 1, pageSize: 25, total: activities.length } }));
}

function emptyList(input: RequestInfo | URL) {
  return answer(input);
}

/** The URLs of the activity-list requests made so far. */
function activityCalls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0])).filter((url) => url.startsWith("/api/v1/activities?"));
}

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "a-1", type: "TASK", subject: "Call the client", description: null, status: "OPEN", priority: "MEDIUM",
    dueAt: "2026-11-21T10:00:00.000Z", startAt: null, endAt: null, reminderAt: null, completedAt: null,
    assigneeId: null, createdById: "u-1", leadId: "l-1", contactId: null, companyId: null, dealId: null,
    createdAt: "2026-11-20T00:00:00.000Z", updatedAt: "2026-11-20T00:00:00.000Z",
    ...overrides,
  };
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
    await waitFor(() => expect(activityCalls(fetchMock)).toHaveLength(1));
    const url = activityCalls(fetchMock)[0]!;
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
    await waitFor(() => expect(activityCalls(fetchMock)).toHaveLength(1));
    const url = activityCalls(fetchMock)[0]!;
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
      return answer(input, completed ? [] : [task({ assigneeId: ME_ID })]);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TasksPageClient />);
    fireEvent.click(await screen.findByRole("button", { name: "Complete" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/activities/a-1/complete", expect.objectContaining({ method: "POST" })));
  });

  it("D100: by default shows only the signed-in user's tasks, and fetches nothing before it knows who that is", async () => {
    let releaseMe: () => void = () => {};
    const meGate = new Promise<void>((resolve) => {
      releaseMe = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/auth/me")) await meGate;
      return answer(input);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TasksPageClient />);

    expect(screen.getByRole("combobox", { name: "Assigned to" }).textContent).toContain("Assigned to me");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(activityCalls(fetchMock)).toHaveLength(0); // no unfiltered request while waiting

    releaseMe();
    await waitFor(() => expect(activityCalls(fetchMock)).toHaveLength(1));
    expect(activityCalls(fetchMock)[0]).toContain(`assigneeId=${ME_ID}`);
    expect(await screen.findByText("Open tasks, calls and meetings assigned to you will show up here.")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Assigned to" })).toBeNull();
  });

  it("D100: \"Everyone\" (assignee=all in the address) sends no assignee filter and adds an Assigned to column", async () => {
    currentSearch = "assignee=all";
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      answer(input, [task({ id: "a-1", assigneeId: ME_ID }), task({ id: "a-2", subject: "Send the quote", assigneeId: ASHA_ID }), task({ id: "a-3", subject: "Loose end", assigneeId: null })]),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TasksPageClient />);

    await waitFor(() => expect(activityCalls(fetchMock).length).toBeGreaterThan(0));
    expect(activityCalls(fetchMock).every((url) => !url.includes("assigneeId"))).toBe(true);
    expect(screen.getByRole("combobox", { name: "Assigned to" }).textContent).toContain("Everyone");
    expect(await screen.findByRole("columnheader", { name: "Assigned to" })).toBeTruthy();
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Unassigned")).toBeTruthy();
  });

  it("D100: a colleague's id in the address shows only their tasks", async () => {
    currentSearch = `assignee=${ASHA_ID}`;
    const fetchMock = vi.fn(emptyList);
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TasksPageClient />);

    await waitFor(() => expect(activityCalls(fetchMock).length).toBeGreaterThan(0));
    expect(activityCalls(fetchMock).at(-1)).toContain(`assigneeId=${ASHA_ID}`);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Assigned to" }).textContent).toContain("Asha Rao"));
    expect(await screen.findByText("Open tasks, calls and meetings assigned to Asha Rao will show up here.")).toBeTruthy();
  });
});
