import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { LeadResponse } from "@growspark/shared";
import { LeadForm, leadToFormValues } from "@/components/leads/lead-form";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/lead-sources")) {
        return Promise.resolve(jsonResponse(200, { data: [{ id: "src-1", name: "Manual" }] }));
      }
      if (url.includes("/users/options")) {
        return Promise.resolve(jsonResponse(200, { data: [] }));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    }),
  );
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const sampleLead: LeadResponse = {
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
};

describe("leadToFormValues (D42 reset target)", () => {
  it("returns every field blank/undefined with no lead — exactly what the create form's cleanup resets to", () => {
    const blank = leadToFormValues();
    expect(blank.firstName).toBe("");
    expect(blank.email).toBe("");
    expect(blank.phone).toBe("");
    expect(blank.companyName).toBe("");
    expect(blank.sourceId).toBe("");
    expect(blank.priority).toBe("MEDIUM");
    expect(blank.ownerId).toBeUndefined();
    expect(blank.requirement).toBe("");
  });

  it("resetting a dirtied form to leadToFormValues() clears the dirtied field — the actual operation the D42 cleanup performs", () => {
    const { result } = renderHook(() => useForm({ defaultValues: leadToFormValues() }));

    act(() => {
      result.current.setValue("firstName", "Stale lead name");
    });
    expect(result.current.getValues("firstName")).toBe("Stale lead name");

    act(() => {
      result.current.reset(leadToFormValues());
    });
    expect(result.current.getValues("firstName")).toBe("");
  });
});

describe("LeadForm (D42: create form must open empty every time)", () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("create mode: typing a value then unmounting (the same effect-cleanup path Activity hide triggers per Next's Cache Components docs) does not throw", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderWithClient(
      <LeadForm mode="create" onSubmit={vi.fn()} submitLabel="Add lead" pendingLabel="Adding…" onCancel={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByLabelText("First name")).toBeTruthy());

    const firstName = screen.getByLabelText("First name") as HTMLInputElement;
    fireEvent.change(firstName, { target: { value: "Stale lead" } });
    expect(firstName.value).toBe("Stale lead");

    unmount();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("edit mode: the same unmount (cleanup) does not throw — the blank-reset guard only applies to create", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderWithClient(
      <LeadForm
        mode="edit"
        lead={sampleLead}
        onSubmit={vi.fn()}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        onCancel={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText("First name")).toBeTruthy());
    unmount();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
