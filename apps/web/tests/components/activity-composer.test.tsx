import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActivityComposer } from "@/components/activities/activity-composer";
import { NextActivityField, RecordTimeline } from "@/components/activities/record-timeline";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderWithClient(element: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

const userId = "00000000-0000-4000-8000-000000000001";
const recordId = "00000000-0000-4000-8000-000000000007";
const me = { data: { user: { id: userId, email: "staff@example.test", name: "Staff User", role: "STAFF" }, organization: { name: "Org", timezone: "Asia/Kolkata", currency: "INR" }, permissions: [] } };

describe("Activity composer and record timeline (package 4.3)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the selected activity type and links it to the current record", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(me));
      if (url.includes("/users/options")) return Promise.resolve(jsonResponse({ data: [{ id: userId, name: "Staff User" }] }));
      if (url.endsWith("/activities")) return Promise.resolve(jsonResponse({ data: {} }, 201));
      return Promise.resolve(jsonResponse({ data: [], meta: { page: 1, pageSize: 10, total: 0 } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<ActivityComposer owner="leads" recordId={recordId} />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Assignee" }).textContent).toContain("Staff User"));
    fireEvent.click(screen.getByRole("tab", { name: "Call" }));
    fireEvent.change(screen.getByLabelText("Subject *"), { target: { value: "Call about renewal" } });
    fireEvent.click(screen.getByRole("button", { name: "Save activity" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/activities", expect.objectContaining({ method: "POST" })));
    const request = fetchMock.mock.calls.find(([input]) => String(input) === "/api/v1/activities")?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ type: "CALL", subject: "Call about renewal", leadId: recordId, assigneeId: userId });
  });

  it("saves a Note without a due date", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      return String(input).includes("/auth/me") ? Promise.resolve(jsonResponse(me))
        : String(input).includes("/users/options") ? Promise.resolve(jsonResponse({ data: [] }))
          : Promise.resolve(jsonResponse({ data: {} }, 201));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<ActivityComposer owner="contacts" recordId={recordId} />);
    fireEvent.click(screen.getByRole("tab", { name: "Note" }));
    expect(screen.queryByLabelText("Due date and time")).toBeNull();
    fireEvent.change(screen.getByLabelText("Subject *"), { target: { value: "Sent proposal" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/activities", expect.objectContaining({ method: "POST" })));
    const request = fetchMock.mock.calls.find(([input]) => String(input) === "/api/v1/activities")?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({ type: "NOTE", subject: "Sent proposal", contactId: recordId });
    expect(body).not.toHaveProperty("dueAt");
  });

  it("refreshes the timeline after completing an open activity and shows who and when", async () => {
    let completed = false;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(me));
      if (url.includes("/users/options")) return Promise.resolve(jsonResponse({ data: [] }));
      if (url.endsWith("/activities/a-1/complete")) { completed = true; return Promise.resolve(jsonResponse({ data: {} })); }
      if (url.includes(`/leads/${recordId}/timeline`)) return Promise.resolve(jsonResponse({
        data: [{ id: "a-1", kind: "ACTIVITY", at: "2026-11-20T10:00:00.000Z", title: "TASK: Follow up", description: null, actorId: "user-1", status: completed ? "DONE" : "OPEN", completedAt: completed ? "2026-11-20T11:00:00.000Z" : null, completedByName: completed ? "Staff User" : null }],
        meta: { page: 1, pageSize: 10, total: 1 },
      }));
      return Promise.resolve(jsonResponse({ data: {}, meta: { page: 1, pageSize: 10, total: 0 } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<RecordTimeline owner="leads" recordId={recordId} />);
    fireEvent.click(await screen.findByRole("button", { name: "Complete" }));
    expect(await screen.findByText(/Completed by Staff User/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Complete" })).toBeNull();
  });

  it("labels an overdue next activity with both a status dot and the word", () => {
    renderWithClient(<NextActivityField activity={{ type: "TASK", subject: "Past due", dueAt: "2026-11-20T10:00:00.000Z", isOverdue: true }} />);
    expect(screen.getByText("Overdue")).toBeTruthy();
  });
});
