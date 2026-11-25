import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { ImportWizard } from "@/components/imports/import-wizard";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const CSV = "Name,Email,Company\r\nAsha Rao,asha@example.test,Example Foods\r\nBad,bad-email,\r\n";
const SUMMARY = { totalRows: 2, blankRowsSkipped: 1, companiesToCreate: ["Example Foods"], keptAsCapturedFields: [] };

function previewBody(withRows: boolean, mappingErrors: string[] = []) {
  return {
    data: {
      headers: ["Name", "Email", "Company"],
      samples: ["Asha Rao", "asha@example.test", "Example Foods"],
      mapping: ["fullName", "email", "companyName"],
      mappingErrors,
      summary: withRows ? { ...SUMMARY, ready: 1, duplicates: 0, errors: 1 } : { ...SUMMARY, ready: 0, duplicates: 0, errors: 0 },
      rows: withRows
        ? [
            { rowNumber: 2, status: "ok", errors: [], notes: ['Will create company "Example Foods".'], name: "Asha Rao", email: "asha@example.test", phone: null, companyName: "Example Foods", createsCompany: true },
            { rowNumber: 3, status: "error", errors: ['Email "bad-email" is not a valid email address.'], notes: [], name: "Bad", email: "bad-email", phone: null, companyName: null, createsCompany: false },
          ]
        : [],
    },
  };
}

const COMMIT = {
  data: { imported: 1, skippedDuplicates: 0, errors: 1, blankRowsSkipped: 1, companiesCreated: 1, errorsCsv: "﻿Row,Result,Problem\r\n3,Error,bad\r\n" },
};

function stubFetch(previewResponses: unknown[]) {
  const queue = [...previewResponses];
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url) => {
    if (url.endsWith("/preview")) return Promise.resolve(jsonResponse(queue.shift()));
    if (url.endsWith("/commit")) return Promise.resolve(jsonResponse(COMMIT));
    return Promise.resolve(jsonResponse({ data: [] }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof stubFetch>, suffix: string, nth = 0) {
  const calls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith(suffix));
  return JSON.parse(String((calls[nth]![1] as RequestInit).body));
}

function renderWizard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ImportWizard entity="contacts" />
    </QueryClientProvider>,
  );
}

function chooseFile(content: string, size?: number) {
  const file = new File([content], "contacts.csv", { type: "text/csv" });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  const input = document.getElementById("import-file") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImportWizard", () => {
  it("upload → match columns → check rows → import, sending the same file and mapping each time", async () => {
    const fetchMock = stubFetch([previewBody(false), previewBody(true)]);
    const createObjectURL = vi.fn(() => "blob:skipped");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    renderWizard();

    expect(screen.getByRole("link", { name: /Download a sample file/ }).getAttribute("href")).toBe("/api/v1/imports/contacts/template");
    chooseFile(CSV);

    // Step 2: the server's suggested mapping and each column's first value.
    expect(await screen.findByText("2. Match the columns")).toBeTruthy();
    expect(bodyOf(fetchMock, "/preview")).toEqual({ csv: CSV });
    expect(screen.getByText("asha@example.test")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Check rows" }));
    expect(await screen.findByText("3. Check before importing")).toBeTruthy();
    expect(bodyOf(fetchMock, "/preview", 1)).toEqual({ csv: CSV, mapping: ["fullName", "email", "companyName"] });
    expect(screen.getByText(/New companies that will be created \(1\):/)).toBeTruthy();
    expect(screen.getByText('Email "bad-email" is not a valid email address.')).toBeTruthy();

    // Filter to errors only.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Errors (1)" }));
    fireEvent.click(screen.getByRole("tab", { name: "Errors (1)" }));
    await waitFor(() => expect(screen.queryByText("Asha Rao")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Import 1 contact" }));
    expect(await screen.findByText("Import finished")).toBeTruthy();
    expect(bodyOf(fetchMock, "/commit")).toEqual({ csv: CSV, mapping: ["fullName", "email", "companyName"] });
    const finished = screen.getByText("Import finished").closest("section")!;
    expect(within(finished).getByText(/new\s+company created/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Download the 1 skipped row" }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("stays on the column step and shows the server's mapping problems", async () => {
    stubFetch([previewBody(false), previewBody(false, ["Choose a column for First name or Full name."])]);
    renderWizard();
    chooseFile(CSV);
    await screen.findByText("2. Match the columns");
    fireEvent.click(screen.getByRole("button", { name: "Check rows" }));
    expect(await screen.findByText("Choose a column for First name or Full name.")).toBeTruthy();
    expect(screen.queryByText("3. Check before importing")).toBeNull();
  });

  it("refuses a file over 1 MB without sending it", async () => {
    const fetchMock = stubFetch([]);
    renderWizard();
    chooseFile("x", 1024 * 1024 + 1);
    expect(await screen.findByText(/larger than 1 MB/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a server error from the first upload (e.g. a broken file) on the upload step", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ error: { code: "VALIDATION_FAILED", message: "A quoted value starting on line 2 is never closed.", requestId: "r" } }, 422),
        ),
      ),
    );
    renderWizard();
    chooseFile('Name\r\n"broken');
    expect(await screen.findByText(/never closed/)).toBeTruthy();
    expect(screen.getByText("1. Choose a CSV file")).toBeTruthy();
  });

  it("disables Import when no row is ready", async () => {
    const nothingReady = previewBody(true);
    nothingReady.data.summary.ready = 0;
    nothingReady.data.rows = nothingReady.data.rows.filter((row) => row.status !== "ok");
    stubFetch([previewBody(false), nothingReady]);
    renderWizard();
    chooseFile(CSV);
    await screen.findByText("2. Match the columns");
    fireEvent.click(screen.getByRole("button", { name: "Check rows" }));
    const button = (await screen.findByRole("button", { name: "Import 0 contacts" })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
