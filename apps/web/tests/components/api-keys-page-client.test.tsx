import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ROLES } from "@growspark/shared";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

import { ApiKeysPageClient } from "@/components/api-keys/api-keys-page-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const ME_RESPONSE = {
  data: {
    user: { id: "admin-1", email: "admin@example.test", name: "Admin User", role: ROLES.ADMIN },
    organization: { name: "Test Org", timezone: "Asia/Kolkata", currency: "INR" },
    permissions: ["settings:manage"],
  },
};

const OLD_KEY_ID = "key-old";
const NEW_KEY_ID = "key-new";
const NEW_RAW_KEY = "gsk_live_brandNewRawKeyValueShouldAppearHere";

function activeKeyRow() {
  return {
    id: OLD_KEY_ID,
    name: "Website intake",
    keyPrefix: "gsk_live_OldOne",
    revokedAt: null,
    lastUsedAt: null,
    createdById: "admin-1",
    createdAt: "2026-11-20T00:00:00.000Z",
    updatedAt: "2026-11-20T00:00:00.000Z",
  };
}

function rotatedListRows() {
  return [
    { ...activeKeyRow(), revokedAt: "2026-11-24T00:00:00.000Z" },
    {
      id: NEW_KEY_ID,
      name: "Website intake",
      keyPrefix: "gsk_live_NewOneX",
      revokedAt: null,
      lastUsedAt: null,
      createdById: "admin-1",
      createdAt: "2026-11-24T00:00:00.000Z",
      updatedAt: "2026-11-24T00:00:00.000Z",
    },
  ];
}

/** Regression test for the bug reported in manual testing: rotating a key
 * never showed the new raw key, because the list was refetched immediately
 * on success, which re-rendered the row's apiKey.revokedAt as true and
 * unmounted RotateApiKeyDialog (and its open reveal dialog) before the user
 * ever saw it. See docs/decisions.md D75. */
function renderWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiKeysPageClient />
    </QueryClientProvider>,
  );
}

describe("ApiKeysPageClient: rotate reveals the new key (regression)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    replaceMock.mockClear();
  });

  it("after confirming Rotate, the reveal view with the new raw key is displayed and stays displayed even once the list has refetched", async () => {
    let listCallCount = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(ME_RESPONSE));
      }
      if (url.includes(`/api-keys/${OLD_KEY_ID}/rotate`) && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({
            data: { ...rotatedListRows()[1], key: NEW_RAW_KEY },
          }),
        );
      }
      if (url.includes("/api-keys")) {
        listCallCount += 1;
        const data = listCallCount === 1 ? [activeKeyRow()] : rotatedListRows();
        return Promise.resolve(jsonResponse({ data, meta: { page: 1, pageSize: 100, total: data.length } }));
      }
      return Promise.resolve(jsonResponse({ data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient();

    // Initial list loads: one active key, with a Rotate button.
    await screen.findByText("Website intake");
    fireEvent.click(screen.getByRole("button", { name: "Rotate" }));

    const confirmDialog = await screen.findByRole("dialog");
    within(confirmDialog).getByText(/will stop working immediately/);
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "Rotate key" }));

    // The reveal view must appear...
    const revealDialog = await screen.findByRole("dialog");
    await within(revealDialog).findByText("API key rotated");
    const keyInput = within(revealDialog).getByLabelText("New API key") as HTMLInputElement;
    expect(keyInput.value).toBe(NEW_RAW_KEY);

    // ...and must NOT disappear shortly afterwards. Under the original bug,
    // rotating immediately invalidated/refetched the list, which would have
    // resolved by now and re-rendered this row as revoked — unmounting this
    // very dialog before this assertion runs. Giving a short delay a chance
    // to let any such pending refetch/re-render actually happen is exactly
    // what makes this a real regression test, not a vacuous one.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText("API key rotated")).toBeTruthy();
    expect((screen.getByLabelText("New API key") as HTMLInputElement).value).toBe(NEW_RAW_KEY);

    // Closing the dialog now triggers the deferred list refresh.
    fireEvent.click(within(revealDialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(listCallCount).toBeGreaterThanOrEqual(2));
    await screen.findByText("Revoked");
  });
});
