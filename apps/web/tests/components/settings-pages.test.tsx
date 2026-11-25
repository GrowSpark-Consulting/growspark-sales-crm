import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ROLES } from "@growspark/shared";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

import { SettingsPageClient } from "@/components/settings/settings-page-client";
import { ProfilePageClient } from "@/components/settings/profile-page-client";
import { LeadSourcesSettingsPageClient, moveId } from "@/components/settings/lead-sources-settings-page-client";
import { PipelineSettingsPageClient } from "@/components/settings/pipeline-settings-page-client";
import { selectableLeadSources } from "@/hooks/use-lead-sources";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function me(role: ROLES) {
  return {
    data: {
      user: { id: "u-1", email: "person@example.test", name: "Asha Rao", role },
      organization: { name: "Test Org", timezone: "Asia/Kolkata", currency: "INR" },
      permissions: [],
    },
  };
}

type Handler = (url: string, init?: RequestInit) => Response | undefined;

function stubFetch(role: ROLES, handler: Handler = () => undefined) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(me(role)));
    return Promise.resolve(handler(url, init) ?? jsonResponse({ data: [] }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function callsTo(fetchMock: ReturnType<typeof vi.fn>, method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([url, init]) => String(url).includes(path) && ((init as RequestInit | undefined)?.method ?? "GET") === method,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  replaceMock.mockClear();
});

describe("Settings hub", () => {
  it("Staff see only My profile; Admins also see every administration link", async () => {
    stubFetch(ROLES.STAFF);
    const { unmount } = renderWithClient(<SettingsPageClient />);
    expect((await screen.findByRole("link", { name: /My profile/ })).getAttribute("href")).toBe("/settings/profile");
    expect(screen.queryByRole("link", { name: /Organisation/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /API keys/ })).toBeNull();
    unmount();

    stubFetch(ROLES.ADMIN);
    renderWithClient(<SettingsPageClient />);
    for (const [name, href] of [
      [/Organisation/, "/settings/organization"],
      [/Lead sources/, "/settings/lead-sources"],
      [/Pipeline stages/, "/settings/pipeline"],
      [/^Users/, "/users"],
      [/API keys/, "/settings/api-keys"],
      [/Audit log/, "/settings/audit-log"],
    ] as const) {
      expect((await screen.findByRole("link", { name })).getAttribute("href")).toBe(href);
    }
  });
});

describe("My profile — change password", () => {
  it("sends only current and new password; a wrong current password shows a field error and does not sign the user out", async () => {
    const fetchMock = stubFetch(ROLES.STAFF, (url) =>
      url.includes("/auth/change-password")
        ? jsonResponse(
            {
              error: {
                code: "VALIDATION_FAILED",
                message: "Current password is incorrect",
                details: [{ path: "currentPassword", message: "Current password is incorrect" }],
                requestId: "r-1",
              },
            },
            422,
          )
        : undefined,
    );
    renderWithClient(<ProfilePageClient />);
    expect(await screen.findByText("Staff Executive")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "wrong-password" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-new-password-1" } });
    fireEvent.change(screen.getByLabelText("New password again"), { target: { value: "a-new-password-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findAllByText("Current password is incorrect")).not.toHaveLength(0);
    const [call] = callsTo(fetchMock, "POST", "/auth/change-password");
    expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({
      currentPassword: "wrong-password",
      newPassword: "a-new-password-1",
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("refuses to submit when the two new passwords differ", async () => {
    const fetchMock = stubFetch(ROLES.ADMIN);
    renderWithClient(<ProfilePageClient />);
    await screen.findByText("Admin");
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "current-password" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-new-password-1" } });
    fireEvent.change(screen.getByLabelText("New password again"), { target: { value: "a-new-password-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("The two new passwords do not match")).toBeTruthy();
    expect(callsTo(fetchMock, "POST", "/auth/change-password")).toHaveLength(0);
  });
});

const SOURCES = [
  { id: "s-web", name: "Website", isActive: true, sortOrder: 1, locked: true, leadCount: 4 },
  { id: "s-ref", name: "Referral", isActive: true, sortOrder: 2, locked: false, leadCount: 2 },
  { id: "s-old", name: "Old fair", isActive: false, sortOrder: 3, locked: false, leadCount: 0 },
];

describe("Lead sources settings", () => {
  it("sends Staff to /forbidden and never asks for the settings list", async () => {
    const fetchMock = stubFetch(ROLES.STAFF);
    renderWithClient(<LeadSourcesSettingsPageClient />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/forbidden"));
    expect(callsTo(fetchMock, "GET", "/settings/lead-sources")).toHaveLength(0);
  });

  it("offers no Rename/Deactivate on a System source, Reactivate on an inactive one, and moving down sends the full new order", async () => {
    const fetchMock = stubFetch(ROLES.ADMIN, (url, init) => {
      if (url.includes("/settings/lead-sources/order") && init?.method === "PUT") return jsonResponse({ data: SOURCES });
      if (url.includes("/settings/lead-sources")) return jsonResponse({ data: SOURCES });
      return undefined;
    });
    renderWithClient(<LeadSourcesSettingsPageClient />);

    const websiteRow = (await screen.findByText("Website")).closest("tr")!;
    expect(within(websiteRow).getByText("System")).toBeTruthy();
    expect(within(websiteRow).queryByRole("button", { name: "Rename" })).toBeNull();
    expect(within(websiteRow).queryByRole("button", { name: "Deactivate" })).toBeNull();

    const oldRow = screen.getByText("Old fair").closest("tr")!;
    expect(within(oldRow).getByRole("button", { name: "Reactivate" })).toBeTruthy();
    expect(within(screen.getByText("Referral").closest("tr")!).getByRole("button", { name: "Deactivate" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Move Website down" }));
    await waitFor(() => expect(callsTo(fetchMock, "PUT", "/settings/lead-sources/order")).toHaveLength(1));
    const [call] = callsTo(fetchMock, "PUT", "/settings/lead-sources/order");
    expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({ ids: ["s-ref", "s-web", "s-old"] });
    expect((screen.getByRole("button", { name: "Move Website up" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

const STAGES = [
  { id: "st-1", name: "Qualification", position: 1, probability: 10, type: "OPEN", dealCount: 3, deletable: false },
  { id: "st-2", name: "Demo", position: 2, probability: 30, type: "OPEN", dealCount: 0, deletable: true },
  { id: "st-won", name: "Won", position: 3, probability: 100, type: "WON", dealCount: 1, deletable: false },
  { id: "st-lost", name: "Lost", position: 4, probability: 0, type: "LOST", dealCount: 0, deletable: false },
];

describe("Pipeline stage settings", () => {
  it("Won/Lost get no arrows and no Delete; a used stage’s Delete is disabled; an unused one can be deleted", async () => {
    const fetchMock = stubFetch(ROLES.ADMIN, (url, init) => {
      if (url.includes("/settings/pipeline-stages/st-2") && init?.method === "DELETE") {
        return jsonResponse({ data: STAGES.filter((stage) => stage.id !== "st-2") });
      }
      if (url.includes("/settings/pipeline-stages")) return jsonResponse({ data: STAGES });
      return undefined;
    });
    renderWithClient(<PipelineSettingsPageClient />);

    const wonRow = (await screen.findByText("Won", { selector: "td" })).closest("tr")!;
    expect(within(wonRow).queryByRole("button", { name: /Move/ })).toBeNull();
    expect(within(wonRow).queryByRole("button", { name: "Delete" })).toBeNull();
    expect(within(wonRow).getByRole("button", { name: "Edit" })).toBeTruthy();

    const usedRow = screen.getByText("Qualification").closest("tr")!;
    expect((within(usedRow).getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(true);

    const demoRow = screen.getByText("Demo").closest("tr")!;
    fireEvent.click(within(demoRow).getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(callsTo(fetchMock, "DELETE", "/settings/pipeline-stages/st-2")).toHaveLength(1));
  });

  it("editing a Won stage sends only its name (probability is shown read-only)", async () => {
    const fetchMock = stubFetch(ROLES.ADMIN, (url) =>
      url.includes("/settings/pipeline-stages") ? jsonResponse({ data: STAGES }) : undefined,
    );
    renderWithClient(<PipelineSettingsPageClient />);
    const wonRow = (await screen.findByText("Won", { selector: "td" })).closest("tr")!;
    fireEvent.click(within(wonRow).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Probability/).hasAttribute("readonly")).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: "Closed won" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(callsTo(fetchMock, "PATCH", "/settings/pipeline-stages/st-won")).toHaveLength(1));
    const [call] = callsTo(fetchMock, "PATCH", "/settings/pipeline-stages/st-won");
    expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({ name: "Closed won" });
  });
});

describe("helpers", () => {
  it("moveId swaps neighbours and ignores moves past either end", () => {
    expect(moveId(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveId(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });

  it("selectableLeadSources keeps active sources plus the record’s own inactive one, labelled", () => {
    const sources = SOURCES.map(({ id, name, isActive, sortOrder }) => ({ id, name, isActive, sortOrder }));
    expect(selectableLeadSources(sources, undefined).map((source) => source.label)).toEqual(["Website", "Referral"]);
    expect(selectableLeadSources(sources, "s-old").map((source) => source.label)).toEqual([
      "Website",
      "Referral",
      "Old fair (inactive)",
    ]);
  });
});
