import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { LeadResponse } from "@growspark/shared";
import { ConvertLeadDialog } from "@/components/leads/convert-lead-dialog";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
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
  status: "QUALIFIED",
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
};

function stubFetch(postHandler?: (body: unknown) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/conversion-matches")) {
        return Promise.resolve(jsonResponse(200, { data: { companies: [], contacts: [] } }));
      }
      if (url.includes("/pipeline/stages")) {
        return Promise.resolve(
          jsonResponse(200, {
            data: [{ id: "stage-1", pipelineId: "pipe-1", name: "Qualification", position: 1, probability: 10, type: "OPEN" }],
          }),
        );
      }
      if (url.includes("/convert") && init?.method === "POST") {
        const body: unknown = init.body ? JSON.parse(init.body as string) : undefined;
        return Promise.resolve(postHandler ? postHandler(body) : jsonResponse(200, { data: { leadId: "lead-1", companyId: "co-1", contactId: "ct-1", dealId: null, createdCompany: true, createdContact: true } }));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    }),
  );
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("ConvertLeadDialog (package 3.5)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("with no suggested company match, defaults to Create new and requires a name before submitting", async () => {
    stubFetch();
    renderWithClient(<ConvertLeadDialog lead={sampleLead} trigger={<button>Convert</button>} />);

    fireEvent.click(screen.getByRole("button", { name: "Convert" }));
    const dialog = await screen.findByRole("dialog");

    // No company match for this lead (companyName is null) — Create new is
    // the default, and the name field starts blank, so submit is disabled.
    // The form fields are only rendered once the matches lookup has
    // settled (package 3.5 fix: this prevents a slower network response
    // from arriving after the user has already started typing and silently
    // overwriting it), so this is a findBy, not a getBy.
    const nameInput = (await within(dialog).findByLabelText("Company name *")) as HTMLInputElement;
    expect(nameInput.value).toBe("");
    const submit = within(dialog).getByRole("button", { name: "Convert lead" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(nameInput, { target: { value: "Typed In Dialog Co" } });
    await waitFor(() => expect((within(dialog).getByRole("button", { name: "Convert lead" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("deal fields are hidden once 'Create a deal' is toggled off", async () => {
    stubFetch();
    renderWithClient(<ConvertLeadDialog lead={sampleLead} trigger={<button>Convert</button>} />);

    fireEvent.click(screen.getByRole("button", { name: "Convert" }));
    const dialog = await screen.findByRole("dialog");

    expect(await within(dialog).findByLabelText("Deal name")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Create a deal" }));

    expect(within(dialog).queryByLabelText("Deal name")).toBeNull();
    expect(within(dialog).queryByLabelText("Value (₹)")).toBeNull();
  });

  it("a double click on submit sends exactly one convert request", async () => {
    let postCount = 0;
    stubFetch((body) => {
      postCount += 1;
      void body;
      return jsonResponse(200, { data: { leadId: "lead-1", companyId: "co-1", contactId: "ct-1", dealId: null, createdCompany: true, createdContact: true } });
    });
    renderWithClient(<ConvertLeadDialog lead={{ ...sampleLead, companyName: "Example Foods" }} trigger={<button>Convert</button>} />);

    fireEvent.click(screen.getByRole("button", { name: "Convert" }));
    const dialog = await screen.findByRole("dialog");

    // companyName is set, so Create new's required-name check is already
    // satisfied — submit is enabled without any further input.
    const submit = await within(dialog).findByRole("button", { name: "Convert lead" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(screen.getByText(/was converted/)).toBeTruthy());
    expect(postCount).toBe(1);
  });
});
