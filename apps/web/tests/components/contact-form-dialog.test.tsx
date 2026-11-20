import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ContactFormDialog, contactToFormValues } from "@/components/contacts/contact-form-dialog";

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

describe("contactToFormValues (D42 reset target)", () => {
  it("returns every field blank/undefined with no contact — exactly what the create dialog's cleanup resets to", () => {
    const blank = contactToFormValues(undefined, undefined);
    expect(blank.firstName).toBe("");
    expect(blank.email).toBe("");
    expect(blank.phone).toBe("");
    expect(blank.companyId).toBeUndefined();
  });

  it("resetting a dirtied form to contactToFormValues() clears the dirtied field — the actual operation the D42 cleanup performs", () => {
    const { result } = renderHook(() => useForm({ defaultValues: contactToFormValues(undefined, undefined) }));

    act(() => {
      result.current.setValue("firstName", "Stale contact");
    });
    expect(result.current.getValues("firstName")).toBe("Stale contact");

    act(() => {
      result.current.reset(contactToFormValues(undefined, undefined));
    });
    expect(result.current.getValues("firstName")).toBe("");
  });
});

describe("ContactFormDialog (D42: create dialog must not reappear open with stale values)", () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opening, typing a value, then unmounting (the same effect-cleanup path Activity hide triggers) does not throw", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderWithClient(<ContactFormDialog trigger={<button>Add contact</button>} />);

    fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
    await waitFor(() => expect(screen.getByLabelText("First name")).toBeTruthy());

    const firstName = screen.getByLabelText("First name") as HTMLInputElement;
    fireEvent.change(firstName, { target: { value: "Stale contact" } });
    expect(firstName.value).toBe("Stale contact");

    unmount();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
