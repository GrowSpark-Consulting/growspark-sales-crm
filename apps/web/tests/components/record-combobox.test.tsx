import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { CompanySelect } from "@/components/pickers/company-select";
import { ContactSelect } from "@/components/pickers/contact-select";
import { CompanyFilter } from "@/components/pickers/company-filter";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function company(id: number, name: string) {
  return { id: `c-${id}`, name, industry: id === 1 ? "Manufacturing" : null };
}

/** A fake GET /companies: 25 companies "Company 01".."Company 25"; `q` filters by substring; 20 per page. */
function stubCompanies(opts: { delayMs?: number } = {}) {
  const all = Array.from({ length: 25 }, (_, index) => company(index + 1, `Company ${String(index + 1).padStart(2, "0")}`));
  const calls: URL[] = [];
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input, "http://localhost");
    calls.push(url);
    if (opts.delayMs) await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
    if (url.pathname.match(/\/companies\/c-\d+$/)) {
      const found = all.find((candidate) => url.pathname.endsWith(candidate.id));
      return jsonResponse(200, { data: found });
    }
    const q = url.searchParams.get("q")?.toLowerCase();
    const matching = q ? all.filter((candidate) => candidate.name.toLowerCase().includes(q)) : all;
    const pageSize = Number(url.searchParams.get("pageSize"));
    return jsonResponse(200, { data: matching.slice(0, pageSize), meta: { page: 1, pageSize, total: matching.length } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls };
}

function ControlledCompanySelect({ onPick }: { onPick?: (value: { id: string; name: string } | undefined) => void }) {
  const [value, setValue] = useState<{ id: string; name: string } | undefined>();
  return (
    <CompanySelect
      aria-label="Company"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onPick?.(next);
      }}
    />
  );
}

describe("RecordCombobox via CompanySelect (D97)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows the first 20 companies A–Z as soon as it is focused, with no typing, and says there are more", async () => {
    const { calls } = stubCompanies();
    renderWithClient(<ControlledCompanySelect />);

    fireEvent.focus(screen.getByRole("combobox", { name: "Company" }));

    expect(await screen.findByRole("option", { name: /Company 01/ })).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(20);
    expect(screen.getByText("Showing 20 of 25 · type to search more")).toBeTruthy();
    // The first request had no search text, asked for 20, sorted by name.
    expect(calls[0]?.searchParams.get("q")).toBeNull();
    expect(calls[0]?.searchParams.get("pageSize")).toBe("20");
    expect(calls[0]?.searchParams.get("sort")).toBe("name:asc");
    // The grey second line is shown when there is one.
    expect(screen.getByText("Manufacturing")).toBeTruthy();
  });

  it("does not fetch anything until it is opened", () => {
    const { calls } = stubCompanies();
    renderWithClient(<ControlledCompanySelect />);
    expect(calls).toHaveLength(0);
  });

  it("typing narrows the list through the existing ?q= search", async () => {
    const { calls } = stubCompanies();
    renderWithClient(<ControlledCompanySelect />);
    const input = screen.getByRole("combobox", { name: "Company" });
    fireEvent.focus(input);
    await screen.findByRole("option", { name: /Company 01/ });

    fireEvent.change(input, { target: { value: "company 2" } });

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(6)); // 20–25
    expect(calls.at(-1)?.searchParams.get("q")).toBe("company 2");
    expect(screen.getByText("6 companies")).toBeTruthy();
  });

  it("says so when nothing matches", async () => {
    stubCompanies();
    renderWithClient(<ControlledCompanySelect />);
    const input = screen.getByRole("combobox", { name: "Company" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(await screen.findByText('No companies match "zzz".')).toBeTruthy();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("shows a loading state on a slow server, then the options", async () => {
    stubCompanies({ delayMs: 200 });
    renderWithClient(<ControlledCompanySelect />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Company" }));
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(await screen.findByRole("option", { name: /Company 01/ })).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("keeps the previous options on screen (with a Searching… note) while a narrower search runs", async () => {
    stubCompanies({ delayMs: 150 });
    renderWithClient(<ControlledCompanySelect />);
    const input = screen.getByRole("combobox", { name: "Company" });
    fireEvent.focus(input);
    await screen.findByRole("option", { name: /Company 01/ });

    fireEvent.change(input, { target: { value: "company 25" } });

    expect(screen.getByText("Searching…")).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(20);
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
  });

  it("is keyboard operable: ↓ opens, ↓/↑ move the highlight (announced via aria-activedescendant), Enter picks, Esc closes", async () => {
    stubCompanies();
    const onPick = vi.fn();
    renderWithClient(<ControlledCompanySelect onPick={onPick} />);
    const input = screen.getByRole("combobox", { name: "Company" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.getAttribute("aria-expanded")).toBe("false");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-expanded")).toBe("true");
    await screen.findByRole("option", { name: /Company 01/ });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    const highlighted = document.getElementById(input.getAttribute("aria-activedescendant") ?? "");
    expect(highlighted?.textContent).toContain("Company 02");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenLastCalledWith({ id: "c-2", name: "Company 02" });
    expect((input as HTMLInputElement).value).toBe("Company 02");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("reopening a filled picker shows the whole first page, not just the picked one", async () => {
    const { calls } = stubCompanies();
    renderWithClient(<ControlledCompanySelect />);
    const input = screen.getByRole("combobox", { name: "Company" });
    fireEvent.focus(input);
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Company 03/ }));
    expect((input as HTMLInputElement).value).toBe("Company 03");

    fireEvent.blur(input);
    fireEvent.focus(input);

    expect(await screen.findAllByRole("option")).toHaveLength(20);
    expect(calls.every((url) => url.searchParams.get("q") === null)).toBe(true);
    expect(screen.getByRole("option", { name: /Company 03/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("typing over a picked company clears the pick (forms)", async () => {
    stubCompanies();
    const onPick = vi.fn();
    renderWithClient(<ControlledCompanySelect onPick={onPick} />);
    const input = screen.getByRole("combobox", { name: "Company" });
    fireEvent.focus(input);
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Company 03/ }));
    fireEvent.change(input, { target: { value: "Company 0" } });
    expect(onPick).toHaveBeenLastCalledWith(undefined);
  });

  it("keeps the picked name in the box when the form only knows the id (name looked up later, as Deal/Quotation/Contact forms do)", async () => {
    stubCompanies();
    function IdOnlyForm() {
      const [companyId, setCompanyId] = useState("");
      const [lookedUpName, setLookedUpName] = useState("");
      return (
        <>
          <CompanySelect
            aria-label="Company"
            value={companyId ? { id: companyId, name: lookedUpName } : undefined}
            onValueChange={(next) => setCompanyId(next?.id ?? "")}
          />
          <button type="button" onClick={() => setLookedUpName("Company 03 (looked up)")}>
            lookup done
          </button>
        </>
      );
    }
    renderWithClient(<IdOnlyForm />);
    const input = screen.getByRole("combobox", { name: "Company" }) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Company 03/ }));
    expect(input.value).toBe("Company 03");
    // When the detail lookup lands, its name is shown.
    fireEvent.click(screen.getByRole("button", { name: "lookup done" }));
    expect(input.value).toBe("Company 03 (looked up)");
  });

  it("shows a message if the options cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(500, { error: { code: "INTERNAL", message: "boom" } })));
    renderWithClient(<ControlledCompanySelect />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Company" }));
    expect(await screen.findByText(/Could not load companies/)).toBeTruthy();
  });
});

describe("ContactSelect (D97)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens with the chosen company's contacts only (dependent field), A–Z by first name, with email as the second line", async () => {
    const calls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input, "http://localhost");
        calls.push(url);
        return jsonResponse(200, {
          data: [{ id: "p-1", firstName: "Asha", lastName: "Test", email: "asha@example.test", jobTitle: null }],
          meta: { page: 1, pageSize: 20, total: 1 },
        });
      })
    );
    renderWithClient(<ContactSelect aria-label="Contact" companyId="company-7" value={undefined} onValueChange={() => {}} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Contact" }));

    expect(await screen.findByRole("option", { name: /Asha Test/ })).toBeTruthy();
    expect(screen.getByText("asha@example.test")).toBeTruthy();
    expect(calls[0]?.searchParams.get("companyId")).toBe("company-7");
    expect(calls[0]?.searchParams.get("sort")).toBe("firstName:asc");
    expect(calls[0]?.searchParams.get("q")).toBeNull();
    expect(screen.getByText("1 contact")).toBeTruthy();
  });
});

describe("CompanyFilter (D97)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers Any company first, shows the filtered company's name, and keeps the filter while typing until something is picked", async () => {
    stubCompanies();
    const onChange = vi.fn();
    renderWithClient(<CompanyFilter companyId="c-4" onCompanyIdChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Filter by company" });
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("Company 04"));

    fireEvent.focus(input);
    const options = await screen.findAllByRole("option");
    expect(options[0]?.textContent).toBe("Any company");

    // Typing searches but does not clear the current filter...
    fireEvent.change(input, { target: { value: "company 1" } });
    expect(onChange).not.toHaveBeenCalled();
    // ...and leaving without picking puts the current company's name back.
    act(() => {
      fireEvent.blur(input);
    });
    expect((input as HTMLInputElement).value).toBe("Company 04");

    fireEvent.focus(input);
    fireEvent.mouseDown((await screen.findAllByRole("option"))[0]!);
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("can filter on a company beyond the first 100 by searching for it", async () => {
    stubCompanies();
    const onChange = vi.fn();
    renderWithClient(<CompanyFilter companyId={undefined} onCompanyIdChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Filter by company" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Company 25" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Company 25/ }));
    expect(onChange).toHaveBeenLastCalledWith("c-25");
  });
});
