import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatRupees, type QuotationResponse } from "@growspark/shared";
import { QuotationDetailPageClient } from "@/components/quotations/quotation-detail-page-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** The awkward example: 3 × 0.10, 33.33% discount, 18% GST — exactly what the API returns for it. */
function quotationFixture(overrides: Partial<QuotationResponse> = {}): QuotationResponse {
  return {
    id: "q-1", number: "Q-2026-0001", version: 1, pdfReference: "Q-2026-0001-v1", companyId: "co-1", companyName: "Example Foods",
    contactId: "ct-1", contactName: "Asha Rao", dealId: "deal-1", dealName: "Packing line", ownerId: null, ownerName: null,
    status: "DRAFT", issueDate: "2026-11-24", validUntil: "2026-12-24", currency: "INR", discountPercent: "33.33", taxPercent: "18.00",
    subtotal: "0.30", discountAmount: "0.10", taxableAmount: "0.20", taxAmount: "0.04", total: "0.24", terms: "Net 30", notes: null,
    sentAt: null, archivedAt: null, createdAt: "2026-11-24T05:00:00Z", updatedAt: "2026-11-24T05:00:00Z",
    lineItems: [{ id: "l-1", position: 1, description: "Sensor labels", quantity: "3.00", unitPrice: "0.10", discountPercent: "0.00", lineTotal: "0.30" }],
    ...overrides,
  };
}

function stubBackend(initial: QuotationResponse, dealStatus: "OPEN" | "WON" = "OPEN") {
  let quotation = initial;
  const posts: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        posts.push({ url, body });
        if (url.endsWith("/quotations/q-1/status")) {
          quotation = { ...quotation, status: body.status };
          return Promise.resolve(jsonResponse(200, { data: quotation }));
        }
        return Promise.resolve(jsonResponse(200, { data: {} }));
      }
      if (url.includes("/quotations/q-1")) return Promise.resolve(jsonResponse(200, { data: quotation }));
      if (url.includes("/deals/deal-1")) return Promise.resolve(jsonResponse(200, { data: { id: "deal-1", name: "Packing line", status: dealStatus, contacts: [] } }));
      return Promise.resolve(jsonResponse(200, { data: [] }));
    }),
  );
  return posts;
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

async function confirmAction(trigger: string, confirm: string) {
  fireEvent.click(screen.getByRole("button", { name: trigger }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: confirm }));
}

describe("QuotationDetailPageClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prints every total exactly as the API returned it, through the same formatter as the PDF", async () => {
    stubBackend(quotationFixture());
    renderWithClient(<QuotationDetailPageClient quotationId="q-1" />);
    const totals = await screen.findByTestId("quotation-totals");

    expect(within(totals).getByText(formatRupees("0.30"))).toBeTruthy();
    expect(within(totals).getByText(`− ${formatRupees("0.10")}`)).toBeTruthy();
    expect(within(totals).getByText(formatRupees("0.20"))).toBeTruthy();
    expect(within(totals).getByText(formatRupees("0.04"))).toBeTruthy();
    expect(within(totals).getByTestId("quotation-total").textContent).toBe("₹ 0.24");
    expect(within(totals).getByText("Discount (33.33%)")).toBeTruthy();
    expect(within(totals).getByText("GST (18%)")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Download PDF/ }).getAttribute("href")).toBe("/api/v1/quotations/q-1/pdf");
  });

  it("a draft can be edited and sent; a sent one can only be accepted or rejected", async () => {
    stubBackend(quotationFixture({ status: "DRAFT" }));
    const { unmount } = renderWithClient(<QuotationDetailPageClient quotationId="q-1" />);
    await screen.findByTestId("quotation-totals");
    expect(screen.getByRole("link", { name: /Edit/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark as sent" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accepted" })).toBeNull();
    unmount();
    vi.unstubAllGlobals();

    stubBackend(quotationFixture({ status: "SENT" }));
    renderWithClient(<QuotationDetailPageClient quotationId="q-1" />);
    await screen.findByTestId("quotation-totals");
    expect(screen.queryByRole("link", { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark as sent" })).toBeNull();
    expect(screen.getByRole("button", { name: "Accepted" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rejected" })).toBeTruthy();
  });

  it("after Accept, offers (does not force) to mark the open linked deal as Won", async () => {
    const posts = stubBackend(quotationFixture({ status: "SENT" }), "OPEN");
    renderWithClient(<QuotationDetailPageClient quotationId="q-1" />);
    await screen.findByTestId("quotation-totals");
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/deals/deal-1"))).toBe(true));

    await confirmAction("Accepted", "Mark accepted");
    expect(await screen.findByText("Mark the deal as Won?")).toBeTruthy();
    expect(posts.some((post) => post.url.includes("/deals/"))).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Mark deal as Won" }));
    await waitFor(() => expect(posts.some((post) => post.url.endsWith("/deals/deal-1/close"))).toBe(true));
    expect(posts.find((post) => post.url.endsWith("/deals/deal-1/close"))!.body).toEqual({ status: "WON" });
  });

  it("choosing Not now leaves the deal alone", async () => {
    const posts = stubBackend(quotationFixture({ status: "SENT" }), "OPEN");
    renderWithClient(<QuotationDetailPageClient quotationId="q-1" />);
    await screen.findByTestId("quotation-totals");
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/deals/deal-1"))).toBe(true));

    await confirmAction("Accepted", "Mark accepted");
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    await waitFor(() => expect(screen.queryByText("Mark the deal as Won?")).toBeNull());
    expect(posts.map((post) => post.url)).toEqual(["/api/v1/quotations/q-1/status"]);
  });

  it("no prompt when the quotation has no deal", async () => {
    stubBackend(quotationFixture({ status: "SENT", dealId: null, dealName: null }));
    renderWithClient(<QuotationDetailPageClient quotationId="q-1" />);
    await screen.findByTestId("quotation-totals");
    await confirmAction("Accepted", "Mark accepted");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText("Mark the deal as Won?")).toBeNull();
  });
});
