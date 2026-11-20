import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { CompanyResponse } from "@growspark/shared";
import { CompanyForm, companyToFormValues } from "@/components/companies/company-form";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubFetch() {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(200, { data: [] }))));
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const sampleCompany: CompanyResponse = {
  id: "co-1",
  name: "Example Foods",
  legalName: null,
  industry: null,
  website: null,
  email: null,
  phone: null,
  employeeSize: null,
  annualRevenue: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postalCode: null,
  country: null,
  ownerId: null,
  description: null,
  archivedAt: null,
  createdAt: "2026-11-20T00:00:00Z",
  updatedAt: "2026-11-20T00:00:00Z",
};

describe("companyToFormValues (D42 reset target)", () => {
  it("returns every field blank/undefined with no company — exactly what the create form's cleanup resets to", () => {
    const blank = companyToFormValues();
    expect(blank.name).toBe("");
    expect(blank.legalName).toBe("");
    expect(blank.website).toBe("");
    expect(blank.annualRevenue).toBeUndefined();
    expect(blank.ownerId).toBeUndefined();
  });

  it("resetting a dirtied form to companyToFormValues() clears the dirtied field — the actual operation the D42 cleanup performs", () => {
    const { result } = renderHook(() => useForm({ defaultValues: companyToFormValues() }));

    act(() => {
      result.current.setValue("name", "Stale Co");
    });
    expect(result.current.getValues("name")).toBe("Stale Co");

    act(() => {
      result.current.reset(companyToFormValues());
    });
    expect(result.current.getValues("name")).toBe("");
  });
});

describe("CompanyForm (D42: create form must open empty every time)", () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("create mode (no `company` prop): typing a value then unmounting (the same effect-cleanup path Activity hide triggers) does not throw", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderWithClient(
      <CompanyForm onSubmit={vi.fn()} submitLabel="Add company" pendingLabel="Adding…" onCancel={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByLabelText("Company name")).toBeTruthy());

    const name = screen.getByLabelText("Company name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Stale Co" } });
    expect(name.value).toBe("Stale Co");

    unmount();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("edit mode (`company` prop present): the same unmount (cleanup) does not throw — the blank-reset guard only applies to create", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderWithClient(
      <CompanyForm
        company={sampleCompany}
        onSubmit={vi.fn()}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        onCancel={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText("Company name")).toBeTruthy());
    unmount();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
