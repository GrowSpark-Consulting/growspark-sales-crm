import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OwnerSelect } from "@/components/pickers/owner-select";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("OwnerSelect", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches active user options from GET /api/v1/users/options", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        data: [
          { id: "u1", name: "Asha Rao" },
          { id: "u2", name: "Deepak Shah" },
        ],
      }),
    );

    renderWithClient(<OwnerSelect value={undefined} onValueChange={() => {}} aria-label="Owner" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/users/options",
        expect.objectContaining({ credentials: "same-origin" }),
      );
    });
  });

  it("renders an accessible combobox trigger", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: [] }));

    renderWithClient(<OwnerSelect value={undefined} onValueChange={() => {}} aria-label="Owner" />);

    expect(screen.getByRole("combobox", { name: "Owner" })).toBeTruthy();
  });

  it("does not re-fetch when re-rendered with a different value (owner list is shared, cached by query key)", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: [{ id: "u1", name: "Asha Rao" }] }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <OwnerSelect value={undefined} onValueChange={() => {}} aria-label="Owner" />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    rerender(
      <QueryClientProvider client={queryClient}>
        <OwnerSelect value="u1" onValueChange={() => {}} aria-label="Owner" />
      </QueryClientProvider>,
    );

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
