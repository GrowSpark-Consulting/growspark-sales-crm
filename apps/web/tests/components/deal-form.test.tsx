import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { DealResponse } from "@growspark/shared";
import { DealForm, dealToFormValues } from "@/components/deals/deal-form";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/pipeline/stages")) {
        return Promise.resolve(
          jsonResponse(200, {
            data: [
              { id: "stage-1", pipelineId: "pipe-1", name: "Qualification", position: 1, probability: 10, type: "OPEN" },
              { id: "stage-2", pipelineId: "pipe-1", name: "Proposal", position: 2, probability: 50, type: "OPEN" },
              { id: "stage-3", pipelineId: "pipe-1", name: "Won", position: 3, probability: 100, type: "WON" },
            ],
          }),
        );
      }
      if (url.includes("/lead-sources")) {
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

const sampleDeal: DealResponse = {
  id: "deal-1",
  name: "Example Deal",
  companyId: "co-1",
  pipelineId: "pipe-1",
  stageId: "stage-2",
  value: "250000",
  currency: "INR",
  probability: 50,
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
};

describe("dealToFormValues (D42 reset target)", () => {
  it("returns every field blank/undefined with no deal — exactly what the create form's cleanup resets to", () => {
    const blank = dealToFormValues();
    expect(blank.name).toBe("");
    expect(blank.companyId).toBe("");
    expect(blank.stageId).toBeUndefined();
    expect(blank.value).toBeUndefined();
    expect(blank.probability).toBeUndefined();
    expect(blank.ownerId).toBeUndefined();
  });

  it("resetting a dirtied form to dealToFormValues() clears the dirtied field", () => {
    const { result } = renderHook(() => useForm({ defaultValues: dealToFormValues() }));

    act(() => {
      result.current.setValue("name", "Stale Deal");
    });
    expect(result.current.getValues("name")).toBe("Stale Deal");

    act(() => {
      result.current.reset(dealToFormValues());
    });
    expect(result.current.getValues("name")).toBe("");
  });
});

describe("DealForm (D42: create form must open empty every time)", () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("create mode: typing a value then unmounting (the same effect-cleanup path Activity hide triggers) does not throw", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderWithClient(
      <DealForm onSubmit={vi.fn()} submitLabel="Add deal" pendingLabel="Adding…" onCancel={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByLabelText("Deal name *")).toBeTruthy());

    const name = screen.getByLabelText("Deal name *") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Stale Deal" } });
    expect(name.value).toBe("Stale Deal");

    unmount();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("edit mode: the same unmount (cleanup) does not throw — the blank-reset guard only applies to create", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderWithClient(
      <DealForm deal={sampleDeal} onSubmit={vi.fn()} submitLabel="Save changes" pendingLabel="Saving…" onCancel={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByLabelText("Deal name *")).toBeTruthy());
    unmount();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("DealForm stage default (package 3.3: create defaults to the first open stage, prefilling its probability)", () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("create mode: once stages load, Stage shows the first open stage and Probability is prefilled from it", async () => {
    renderWithClient(<DealForm onSubmit={vi.fn()} submitLabel="Add deal" pendingLabel="Adding…" onCancel={vi.fn()} />);

    const stageTrigger = await screen.findByRole("combobox", { name: "Stage" });
    await waitFor(() => expect(stageTrigger.textContent).toContain("Qualification"));

    const probability = screen.getByLabelText("Probability (%)") as HTMLInputElement;
    await waitFor(() => expect(probability.value).toBe("10"));
  });

  it("edit mode: the Stage field is not rendered at all — stage changes only ever go through Move stage (D47)", async () => {
    renderWithClient(
      <DealForm deal={sampleDeal} onSubmit={vi.fn()} submitLabel="Save changes" pendingLabel="Saving…" onCancel={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByLabelText("Deal name *")).toBeTruthy());
    expect(screen.queryByRole("combobox", { name: "Stage" })).toBeNull();
  });
});
