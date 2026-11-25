import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBell, formatUnreadCount } from "@/components/notifications/notification-bell";
import { NOTIFICATION_POLL_INTERVAL_MS } from "@/hooks/use-notifications";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function countResponse(unread: number) {
  return () => Promise.resolve(jsonResponse({ data: { unread } }));
}

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationBell />
    </QueryClientProvider>,
  );
}

/** Simulates the browser hiding/showing the tab the way TanStack's focusManager listens for it. */
let visibility: DocumentVisibilityState = "visible";
function setTabVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
}

const countCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([url]) => url === "/api/v1/notifications/unread-count").length;

describe("NotificationBell", () => {
  beforeEach(() => {
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the unread count, links to /notifications and names the count for screen readers", async () => {
    vi.stubGlobal("fetch", vi.fn(countResponse(3)));
    renderBell();
    await act(() => vi.advanceTimersByTimeAsync(0));

    const link = screen.getByRole("link", { name: "Notifications, 3 unread" });
    expect(link.getAttribute("href")).toBe("/notifications");
    expect(screen.getByTestId("notification-badge").textContent).toBe("3");
  });

  it("shows no badge at zero, and caps a large count at 99+", async () => {
    vi.stubGlobal("fetch", vi.fn(countResponse(0)));
    renderBell();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByRole("link", { name: "Notifications" })).toBeTruthy();
    expect(screen.queryByTestId("notification-badge")).toBeNull();
    expect(formatUnreadCount(99)).toBe("99");
    expect(formatUnreadCount(100)).toBe("99+");
  });

  it("refetches every 60 seconds while the tab is visible", async () => {
    expect(NOTIFICATION_POLL_INTERVAL_MS).toBe(60_000);
    const fetchMock = vi.fn(countResponse(1));
    vi.stubGlobal("fetch", fetchMock);
    renderBell();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(countCalls(fetchMock)).toBe(1);

    await act(() => vi.advanceTimersByTimeAsync(59_000));
    expect(countCalls(fetchMock)).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(countCalls(fetchMock)).toBe(2);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(countCalls(fetchMock)).toBe(3);
  });

  it("pauses polling while the tab is hidden, and catches up as soon as it is visible again", async () => {
    const fetchMock = vi.fn(countResponse(1));
    vi.stubGlobal("fetch", fetchMock);
    renderBell();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(countCalls(fetchMock)).toBe(1);

    act(() => setTabVisibility("hidden"));
    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000));
    expect(countCalls(fetchMock)).toBe(1);

    fetchMock.mockImplementation(countResponse(4));
    act(() => setTabVisibility("visible"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(countCalls(fetchMock)).toBe(2);
    expect(screen.getByTestId("notification-badge").textContent).toBe("4");

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(countCalls(fetchMock)).toBe(3);
  });

  it("a failed request shows no badge and does not throw", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "INTERNAL", message: "boom" } }, 500))));
    renderBell();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByRole("link", { name: "Notifications" })).toBeTruthy();
    expect(screen.queryByTestId("notification-badge")).toBeNull();
  });
});
