import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DealResponse } from "@growspark/shared";
import { DealDetailPageClient } from "@/components/deals/deal-detail-page-client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const stages = [
  { id: "stage-1", pipelineId: "pipe-1", name: "Qualification", position: 1, probability: 10, type: "OPEN" },
  { id: "stage-2", pipelineId: "pipe-1", name: "Proposal", position: 2, probability: 50, type: "OPEN" },
  { id: "stage-5", pipelineId: "pipe-1", name: "Won", position: 5, probability: 100, type: "WON" },
];

function dealFixture(overrides: Partial<DealResponse>): DealResponse {
  return {
    id: "deal-1",
    name: "Closed Deal",
    companyId: "co-1",
    pipelineId: "pipe-1",
    stageId: "stage-1",
    value: "100000",
    currency: "INR",
    probability: 10,
    expectedCloseDate: null,
    ownerId: null,
    dealType: null,
    sourceId: null,
    status: "OPEN",
    closedAt: null,
    lostReason: null,
    lostNote: null,
    archivedAt: null,
    createdAt: "2026-11-20T00:00:00Z",
    updatedAt: "2026-11-20T00:00:00Z",
    contacts: [],
    ...overrides,
  };
}

function stubFetch(deal: DealResponse) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/stage-history")) return Promise.resolve(jsonResponse(200, { data: [] }));
      if (url.includes("/pipeline/stages")) return Promise.resolve(jsonResponse(200, { data: stages }));
      if (url.includes("/users/options")) return Promise.resolve(jsonResponse(200, { data: [] }));
      if (url.includes("/lead-sources")) return Promise.resolve(jsonResponse(200, { data: [] }));
      if (url.includes("/companies/co-1")) return Promise.resolve(jsonResponse(200, { data: { id: "co-1", name: "Example Foods" } }));
      if (url.includes("/deals/deal-1")) return Promise.resolve(jsonResponse(200, { data: deal }));
      return Promise.resolve(jsonResponse(200, { data: [] }));
    }),
  );
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("DealDetailPageClient (package 3.3: a closed deal is read-only except reopen)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("an OPEN deal shows Edit, Move stage, Close as Won/Lost, and no Reopen", async () => {
    stubFetch(dealFixture({ status: "OPEN" }));
    renderWithClient(<DealDetailPageClient dealId="deal-1" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Closed Deal" })).toBeTruthy());

    expect(screen.getByRole("link", { name: /Edit/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move stage" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close as Won" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close as Lost" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
  });

  it("a WON (closed) deal hides Edit, Move stage, and the close actions, and shows Reopen instead", async () => {
    stubFetch(dealFixture({ status: "WON", stageId: "stage-5", probability: 100, closedAt: "2026-11-20T00:00:00Z" }));
    renderWithClient(<DealDetailPageClient dealId="deal-1" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Closed Deal" })).toBeTruthy());

    expect(screen.queryByRole("link", { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move stage" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close as Won" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close as Lost" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeTruthy();
    // Archive/restore stay available regardless of status (D47).
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
  });
});
