import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const replaceMock = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/notifications",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const unreadRow = {
  id: "01a00000-0000-7000-8000-000000000001",
  type: "LEAD_ASSIGNED",
  title: "Lead assigned to you: Asha Rao",
  href: "/leads/01a00000-0000-7000-8000-0000000000aa",
  readAt: null,
  createdAt: "2026-11-25T06:30:00.000Z",
};
const readRow = {
  id: "01a00000-0000-7000-8000-000000000002",
  type: "QUOTATION_ACCEPTED",
  title: "Quotation Q-2026-0001 accepted (Example Foods)",
  href: "/quotations/01a00000-0000-7000-8000-0000000000bb",
  readAt: "2026-11-25T07:00:00.000Z",
  createdAt: "2026-11-25T05:00:00.000Z",
};

function listBody(rows = [unreadRow, readRow], unread = 1) {
  return { data: rows, meta: { page: 1, pageSize: 25, total: rows.length, unread } };
}

function stubApi(list = listBody()) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === "POST" && url.endsWith("/read-all")) return Promise.resolve(jsonResponse({ data: { updated: 1 } }));
    if (init?.method === "POST") return Promise.resolve(jsonResponse({ data: { ...unreadRow, readAt: "2026-11-25T08:00:00.000Z" } }));
    return Promise.resolve(jsonResponse(list));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsPageClient />
    </QueryClientProvider>,
  );
}

const postsTo = (fetchMock: ReturnType<typeof vi.fn>, url: string) =>
  fetchMock.mock.calls.filter(([calledUrl, init]) => calledUrl === url && (init as RequestInit | undefined)?.method === "POST").length;

describe("Notifications page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    replaceMock.mockClear();
    currentSearch = "";
  });

  it("lists the server's titles as links to the server's hrefs, marking unread ones", async () => {
    const fetchMock = stubApi();
    renderPage();
    const unreadLink = await screen.findByRole("link", { name: unreadRow.title });
    expect(unreadLink.getAttribute("href")).toBe(unreadRow.href);
    expect(screen.getByRole("link", { name: readRow.title }).getAttribute("href")).toBe(readRow.href);
    expect(screen.getByText("(unread)")).toBeTruthy();
    expect(screen.getByRole("button", { name: `Mark "${unreadRow.title}" as read` })).toBeTruthy();
    expect(screen.queryByRole("button", { name: `Mark "${readRow.title}" as read` })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/notifications?page=1&pageSize=25", expect.anything());
  });

  it("Mark read posts to that notification only", async () => {
    const fetchMock = stubApi();
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: `Mark "${unreadRow.title}" as read` }));
    await waitFor(() => expect(postsTo(fetchMock, `/api/v1/notifications/${unreadRow.id}/read`)).toBe(1));
    expect(postsTo(fetchMock, "/api/v1/notifications/read-all")).toBe(0);
  });

  it("opening an unread notification marks it read; opening a read one does not post", async () => {
    const fetchMock = stubApi();
    renderPage();
    fireEvent.click(await screen.findByRole("link", { name: readRow.title }));
    fireEvent.click(screen.getByRole("link", { name: unreadRow.title }));
    await waitFor(() => expect(postsTo(fetchMock, `/api/v1/notifications/${unreadRow.id}/read`)).toBe(1));
    expect(postsTo(fetchMock, `/api/v1/notifications/${readRow.id}/read`)).toBe(0);
  });

  it("Mark all as read posts read-all", async () => {
    const fetchMock = stubApi();
    renderPage();
    await screen.findByRole("link", { name: unreadRow.title });
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(postsTo(fetchMock, "/api/v1/notifications/read-all")).toBe(1));
  });

  it("the Mark all button is disabled when the server says nothing is unread", async () => {
    stubApi(listBody([readRow], 0));
    renderPage();
    await screen.findByRole("link", { name: readRow.title });
    expect((screen.getByRole("button", { name: "Mark all as read" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("the Unread toggle updates the URL, and unread=true reaches the request", async () => {
    stubApi();
    renderPage();
    await screen.findByRole("link", { name: unreadRow.title });
    fireEvent.click(screen.getByRole("button", { name: "Unread (1)" }));
    expect(replaceMock).toHaveBeenCalledWith("/notifications?unread=true");

    await cleanupAndRerenderWith("unread=true");
  });

  it("shows an empty state", async () => {
    stubApi(listBody([], 0));
    renderPage();
    expect(await screen.findByText("No notifications yet")).toBeTruthy();
  });
});

function cleanupAndRerenderWith(search: string) {
  currentSearch = search;
  const fetchMock = stubApi(listBody([unreadRow], 1));
  renderPage();
  return waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/notifications?page=1&pageSize=25&unreadOnly=true", expect.anything()));
}
