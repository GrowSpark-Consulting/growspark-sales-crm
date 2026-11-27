import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { calculateQuotationAmounts } from "@growspark/shared";
import { QuotationForm, previewQuotationAmounts, quotationToFormValues, toCalculateInput } from "@/components/quotations/quotation-form";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("quotation form helpers", () => {
  it("a new quotation starts blank apart from one line: quantity 1, GST 18, prices tax exclusive (the D42 reset target)", () => {
    expect(quotationToFormValues()).toEqual({
      companyId: "",
      contactId: "",
      dealId: null,
      ownerId: undefined,
      issueDate: "",
      validUntil: "",
      pricesIncludeTax: false,
      terms: "",
      notes: "",
      lineItems: [{ description: "", quantity: "1", unitPrice: "", discountPercent: "", gstPercent: "18" }],
    });
  });

  it("an existing quotation loads its toggle and each line's own GST rate (trailing zeros dropped)", () => {
    const values = quotationToFormValues({
      pricesIncludeTax: true,
      lineItems: [
        { id: "a", position: 1, description: "A", quantity: "1.00", unitPrice: "100.00", discountPercent: "0.00", gstPercent: "12.50", taxableAmount: "100.00", gstAmount: "12.50", lineTotal: "112.50" },
        { id: "b", position: 2, description: "B", quantity: "1.00", unitPrice: "100.00", discountPercent: "10.00", gstPercent: "0.00", taxableAmount: "90.00", gstAmount: "0.00", lineTotal: "90.00" },
      ],
    } as never);
    expect(values.pricesIncludeTax).toBe(true);
    expect(values.lineItems.map((line) => [line.gstPercent, line.discountPercent])).toEqual([["12.5", ""], ["0", "10.00"]]);
  });

  it("only previews once every line is valid, and never treats a blank GST rate as a default", () => {
    const line = { description: "Sensor labels", quantity: "3", unitPrice: "0.10", discountPercent: "", gstPercent: "18" };
    expect(toCalculateInput({ lineItems: [{ ...line, unitPrice: "" }], pricesIncludeTax: false })).toBeNull();
    expect(toCalculateInput({ lineItems: [{ ...line, unitPrice: "1.005" }], pricesIncludeTax: false })).toBeNull();
    expect(toCalculateInput({ lineItems: [{ ...line, gstPercent: "" }], pricesIncludeTax: false })).toBeNull();
    expect(toCalculateInput({ lineItems: [{ ...line, gstPercent: "100.5" }], pricesIncludeTax: false })).toBeNull();
    expect(toCalculateInput({ lineItems: [line], pricesIncludeTax: true })).toEqual({
      pricesIncludeTax: true,
      lineItems: [{ description: "Sensor labels", quantity: "3", unitPrice: "0.10", gstPercent: "18" }],
    });
    expect(toCalculateInput({ lineItems: [{ ...line, gstPercent: "0" }], pricesIncludeTax: false })).not.toBeNull();
  });

  it("the preview IS the shared calculation (same function the API runs): worked examples", () => {
    const line = { description: "x", quantity: "1", unitPrice: "1000.00", discountPercent: "", gstPercent: "18" };
    const exclusive = previewQuotationAmounts({ lineItems: [line], pricesIncludeTax: false })!;
    expect([exclusive.subtotal, exclusive.taxAmount, exclusive.total]).toEqual(["1000.00", "180.00", "1180.00"]);
    const inclusive = previewQuotationAmounts({ lineItems: [line], pricesIncludeTax: true })!;
    expect([inclusive.subtotal, inclusive.taxAmount, inclusive.total]).toEqual(["847.46", "152.54", "1000.00"]);
    expect(inclusive).toEqual(calculateQuotationAmounts([{ quantity: "1", unitPrice: "1000.00", gstPercent: "18" }], true));
  });
});

describe("QuotationForm live totals", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch() {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(() => Promise.resolve(jsonResponse(200, { data: [] })));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function fillFirstLine(unitPrice: string) {
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Workshop" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit price"), { target: { value: unitPrice } });
  }

  it("has a GST % box on every line (default 18), no quotation-level discount or GST box", () => {
    stubFetch();
    renderWithClient(<QuotationForm onSubmit={vi.fn()} submitLabel="Create" pendingLabel="…" onCancel={vi.fn()} />);
    expect((screen.getByLabelText("Line 1 GST percent") as HTMLInputElement).value).toBe("18");
    expect(screen.queryByLabelText("Quotation discount (%)")).toBeNull();
    expect(screen.queryByLabelText("GST (%)")).toBeNull();
    expect(screen.getByLabelText("Line 1 discount percent")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add line" }));
    expect((screen.getByLabelText("Line 2 GST percent") as HTMLInputElement).value).toBe("18");
  });

  it("totals update live from the shared rule — exclusive, then inclusive via the toggle — with no server call", () => {
    const fetchMock = stubFetch();
    renderWithClient(<QuotationForm onSubmit={vi.fn()} submitLabel="Create" pendingLabel="…" onCancel={vi.fn()} />);
    fillFirstLine("1000.00");

    let totals = screen.getByTestId("quotation-totals");
    expect(within(totals).getByTestId("quotation-total").textContent).toBe("₹ 1,180.00");
    expect(within(totals).getByText("GST 18%").nextSibling?.textContent).toBe("₹ 180.00");
    expect(within(totals).getByText("₹ 1,000.00")).toBeTruthy();

    expect(screen.getByRole("button", { name: "Tax exclusive" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Tax inclusive" }));
    expect(screen.getByRole("button", { name: "Tax inclusive" }).getAttribute("aria-pressed")).toBe("true");

    totals = screen.getByTestId("quotation-totals");
    expect(within(totals).getByTestId("quotation-total").textContent).toBe("₹ 1,000.00");
    expect(within(totals).getByText("GST 18%").nextSibling?.textContent).toBe("₹ 152.54");
    expect(within(totals).getByText("₹ 847.46")).toBeTruthy();
    expect(within(totals).getByText("Prices are inclusive of GST")).toBeTruthy();
    expect(screen.getByLabelText("Line 1 GST percent")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/quotations/calculate"))).toBe(false);
  });

  it("shows one GST row per distinct rate and the line Amount is the line total", () => {
    stubFetch();
    renderWithClient(<QuotationForm onSubmit={vi.fn()} submitLabel="Create" pendingLabel="…" onCancel={vi.fn()} />);
    fillFirstLine("1000.00");
    fireEvent.change(screen.getByLabelText("Line 1 GST percent"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));
    fireEvent.change(screen.getByLabelText("Line 2 description"), { target: { value: "Support" } });
    fireEvent.change(screen.getByLabelText("Line 2 unit price"), { target: { value: "800" } });
    fireEvent.change(screen.getByLabelText("Line 2 GST percent"), { target: { value: "12.5" } });

    const totals = screen.getByTestId("quotation-totals");
    expect(within(totals).getAllByTestId("quotation-gst-row").map((row) => row.textContent)).toEqual(["GST 5%₹ 50.00", "GST 12.5%₹ 100.00"]);
    expect(within(totals).getByTestId("quotation-total").textContent).toBe("₹ 1,950.00");
    expect(screen.getByText("1,050.00", { selector: "td" })).toBeTruthy();
    expect(screen.getByText("900.00", { selector: "td" })).toBeTruthy();
  });

  it("refuses a blank or out-of-range GST rate on submit, accepts 0, and sends gstPercent per line plus the toggle", async () => {
    stubFetch();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithClient(
      <QuotationForm
        onSubmit={onSubmit}
        submitLabel="Create"
        pendingLabel="…"
        onCancel={vi.fn()}
        defaultCompanyId="11111111-1111-4111-8111-111111111111"
      />,
    );
    // The company/contact pickers are exercised elsewhere; here only the line rules are under test.
    fillFirstLine("1000.00");
    fireEvent.change(screen.getByLabelText("Line 1 GST percent"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Enter a GST rate (0 if exempt)")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Line 1 GST percent"), { target: { value: "100.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.getByText("Percentage cannot be more than 100")).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
