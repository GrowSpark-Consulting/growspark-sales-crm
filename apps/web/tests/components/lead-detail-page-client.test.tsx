import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { LeadResponse, LeadStatus } from "@growspark/shared";
import { LeadDetailPageClient } from "@/components/leads/lead-detail-page-client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function leadFixture(overrides: Partial<LeadResponse>): LeadResponse {
  return {
    id: "lead-1",
    firstName: "Asha",
    lastName: "Rao",
    email: "asha@example.com",
    phone: null,
    companyName: null,
    website: null,
    jobTitle: null,
    industry: null,
    sourceId: "src-1",
    sourceDetail: null,
    status: "NEW",
    priority: "MEDIUM",
    ownerId: null,
    requirement: null,
    estimatedBudget: null,
    purchaseTimeline: null,
    nextFollowUpAt: null,
    notes: null,
    capturedFields: null,
    convertedAt: null,
    archivedAt: null,
    createdAt: "2026-11-20T00:00:00Z",
    updatedAt: "2026-11-20T00:00:00Z",
    conversion: null,
    ...overrides,
  };
}

function stubFetch(lead: LeadResponse) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/status-history")) return Promise.resolve(jsonResponse(200, { data: [] }));
      if (url.includes("/lead-sources")) return Promise.resolve(jsonResponse(200, { data: [] }));
      if (url.includes("/users/options")) return Promise.resolve(jsonResponse(200, { data: [] }));
      if (url.includes("/leads/lead-1")) return Promise.resolve(jsonResponse(200, { data: lead }));
      return Promise.resolve(jsonResponse(200, { data: [] }));
    }),
  );
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("LeadDetailPageClient Convert action (package 3.5)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("QUALIFIED: Convert is a real, enabled trigger", async () => {
    stubFetch(leadFixture({ status: "QUALIFIED" }));
    renderWithClient(<LeadDetailPageClient leadId="lead-1" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Asha Rao" })).toBeTruthy());

    const convert = screen.getByRole("button", { name: "Convert" }) as HTMLButtonElement;
    expect(convert.disabled).toBe(false);
  });

  it.each<LeadStatus>(["NEW", "CONTACTED", "UNQUALIFIED"])(
    "%s: Convert is shown but disabled, not a working trigger",
    async (status) => {
      stubFetch(leadFixture({ status }));
      renderWithClient(<LeadDetailPageClient leadId="lead-1" />);

      await waitFor(() => expect(screen.getByRole("heading", { name: "Asha Rao" })).toBeTruthy());

      const convert = screen.getByRole("button", { name: "Convert" }) as HTMLButtonElement;
      expect(convert.disabled).toBe(true);
    },
  );

  it("CONVERTED: Convert is hidden entirely, and a Converted panel with links replaces the status buttons", async () => {
    stubFetch(
      leadFixture({
        status: "CONVERTED",
        convertedAt: "2026-11-20T10:00:00Z",
        conversion: { companyId: "co-1", contactId: "ct-1", dealId: "deal-1" },
      }),
    );
    renderWithClient(<LeadDetailPageClient leadId="lead-1" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Asha Rao" })).toBeTruthy());

    expect(screen.queryByRole("button", { name: "Convert" })).toBeNull();
    // "Converted" appears twice (the status badge and the panel heading) —
    // the links below are what actually prove the Converted panel rendered.
    expect(screen.getByRole("link", { name: "View company" }).getAttribute("href")).toBe("/companies/co-1");
    expect(screen.getByRole("link", { name: "View contact" }).getAttribute("href")).toBe("/contacts/ct-1");
    expect(screen.getByRole("link", { name: "View deal" }).getAttribute("href")).toBe("/deals/deal-1");
  });

  it("archived (even if QUALIFIED): Convert is hidden entirely", async () => {
    stubFetch(leadFixture({ status: "QUALIFIED", archivedAt: "2026-11-20T00:00:00Z" }));
    renderWithClient(<LeadDetailPageClient leadId="lead-1" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Asha Rao" })).toBeTruthy());

    expect(screen.queryByRole("button", { name: "Convert" })).toBeNull();
  });
});
