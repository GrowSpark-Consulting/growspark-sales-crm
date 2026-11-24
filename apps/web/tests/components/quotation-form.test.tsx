import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuotationForm, quotationToFormValues, toCalculateInput } from "@/components/quotations/quotation-form";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("quotation form helpers", () => {
  it("a new quotation starts blank apart from one line, quantity 1 and 18% GST (the D42 reset target)", () => {
    expect(quotationToFormValues()).toEqual({
      companyId: "",
      contactId: "",
      dealId: null,
      ownerId: undefined,
      issueDate: "",
      validUntil: "",
      discountPercent: "",
      taxPercent: "18",
      terms: "",
      notes: "",
      lineItems: [{ description: "", quantity: "1", unitPrice: "", discountPercent: "" }],
    });
  });

  it("only asks for live totals once every line is valid", () => {
    const line = { description: "Sensor labels", quantity: "3", unitPrice: "0.10", discountPercent: "" };
    expect(toCalculateInput({ lineItems: [{ ...line, unitPrice: "" }], discountPercent: "", taxPercent: "18" })).toBeNull();
    expect(toCalculateInput({ lineItems: [{ ...line, unitPrice: "1.005" }], discountPercent: "", taxPercent: "18" })).toBeNull();
    expect(toCalculateInput({ lineItems: [line], discountPercent: "33.33", taxPercent: "18" })).toEqual({
      discountPercent: "33.33",
      taxPercent: "18",
      lineItems: [{ description: "Sensor labels", quantity: "3", unitPrice: "0.10" }],
    });
  });
});

describe("QuotationForm live totals", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the totals the server calculates, never its own arithmetic", async () => {
    const calculateBodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/quotations/calculate")) {
          calculateBodies.push(JSON.parse(String(init?.body)));
          return Promise.resolve(
            jsonResponse(200, { data: { lineTotals: ["0.30"], subtotal: "0.30", discountAmount: "0.10", taxableAmount: "0.20", taxAmount: "0.04", total: "0.24" } }),
          );
        }
        return Promise.resolve(jsonResponse(200, { data: [] }));
      }),
    );

    renderWithClient(<QuotationForm onSubmit={vi.fn()} submitLabel="Create" pendingLabel="…" onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Sensor labels" } });
    fireEvent.change(screen.getByLabelText("Line 1 quantity"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit price"), { target: { value: "0.10" } });
    fireEvent.change(screen.getByLabelText("Quotation discount (%)"), { target: { value: "33.33" } });

    const totals = screen.getByTestId("quotation-totals");
    await waitFor(() => expect(within(totals).getByTestId("quotation-total").textContent).toBe("₹ 0.24"), { timeout: 3000 });
    expect(calculateBodies.at(-1)).toEqual({ discountPercent: "33.33", taxPercent: "18", lineItems: [{ description: "Sensor labels", quantity: "3", unitPrice: "0.10" }] });
    expect(screen.getByText("0.30")).toBeTruthy();
  });
});
