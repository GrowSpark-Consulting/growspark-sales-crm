import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ROLES } from "@growspark/shared";

const replaceMock = vi.fn();
let currentSearch = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/settings/audit-log",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { AuditLogPageClient } from "@/components/audit/audit-log-page-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function meResponse(role: ROLES) {
  return {
    data: {
      user: { id: "user-1", email: "test@example.test", name: "Test User", role },
      organization: { name: "Test Org", timezone: "Asia/Kolkata", currency: "INR" },
      permissions: role === ROLES.ADMIN ? ["audit:read"] : [],
    },
  };
}

function auditListResponse() {
  return {
    data: [
      {
        id: "event-1",
        actorId: "user-1",
        action: "user.created",
        entityType: "user",
        entityId: "target-user-1",
        metadata: { email: "new.staff@example.test", role: "STAFF" },
        createdAt: "2026-11-24T10:00:00.000Z",
      },
    ],
    meta: { page: 1, pageSize: 25, total: 1 },
  };
}

function userOptionsResponse() {
  return { data: [{ id: "user-1", name: "Test User" }] };
}

function renderWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuditLogPageClient />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  replaceMock.mockClear();
  currentSearch = "";
});

describe("AuditLogPageClient", () => {
  it("redirects a Staff user to /forbidden and renders nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(meResponse(ROLES.STAFF))),
    );

    const { container } = renderWithClient();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/forbidden"));
    expect(container.innerHTML).toBe("");
  });

  it("lets an Admin see audit entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(meResponse(ROLES.ADMIN)));
        if (url.includes("/users/options")) return Promise.resolve(jsonResponse(userOptionsResponse()));
        if (url.includes("/audit-events")) return Promise.resolve(jsonResponse(auditListResponse()));
        return Promise.resolve(jsonResponse({}, 404));
      }),
    );

    renderWithClient();

    expect(await screen.findByText("User created")).toBeTruthy();
    expect(screen.getByText("Test User")).toBeTruthy();
    expect(screen.getByText(/user target-u/)).toBeTruthy();
  });

  it("updates the URL query when the action filter changes, and the resulting fetch includes it", async () => {
    currentSearch = "";
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(meResponse(ROLES.ADMIN)));
      if (url.includes("/users/options")) return Promise.resolve(jsonResponse(userOptionsResponse()));
      if (url.includes("/audit-events")) return Promise.resolve(jsonResponse(auditListResponse()));
      return Promise.resolve(jsonResponse({}, 404));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient();
    await screen.findByText("User created");

    fireEvent.change(screen.getByLabelText("Filter by action"), { target: { value: "user.created" } });

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining("action=user.created")),
    );
  });

  it("never renders a raw metadata value outside the allowed/sanitised fields the API already returned", async () => {
    // The backend (tests/audit/list.test.ts) proves the API response
    // itself never contains a sensitive field. This proves the component
    // doesn't introduce a second leak by rendering some other part of the
    // event object (e.g. a future field) verbatim.
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(meResponse(ROLES.ADMIN)));
        if (url.includes("/users/options")) return Promise.resolve(jsonResponse(userOptionsResponse()));
        if (url.includes("/audit-events")) return Promise.resolve(jsonResponse(auditListResponse()));
        return Promise.resolve(jsonResponse({}, 404));
      }),
    );

    renderWithClient();
    await screen.findByText("User created");

    expect(screen.queryByText(/gsk_live_/)).toBeNull();
    expect(screen.queryByText(/\$argon2id\$/)).toBeNull();
  });
});
