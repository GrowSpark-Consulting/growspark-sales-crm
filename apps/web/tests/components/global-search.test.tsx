import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

import { GlobalSearch, SEARCH_DEBOUNCE_MS } from "@/components/search/global-search";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const RESULTS = {
  data: {
    query: "zep",
    groups: [
      {
        type: "lead",
        label: "Leads",
        results: [
          { id: "l1", title: "Asha Rao", subtitle: "Zephyr Foods · asha@example.test", href: "/leads/l1" },
          { id: "l2", title: "Ravi Iyer", subtitle: "Zephyr Foods", href: "/leads/l2" },
        ],
        hasMore: true,
        seeAllHref: "/leads?q=zep",
      },
      {
        type: "company",
        label: "Companies",
        results: [{ id: "c1", title: "Zephyr Foods", subtitle: "Chennai", href: "/companies/c1" }],
        hasMore: false,
        seeAllHref: "/companies?q=zep",
      },
    ],
  },
};

function stubFetch(body: unknown = RESULTS) {
  const fetchMock = vi.fn<(url: string) => Promise<Response>>(() => Promise.resolve(jsonResponse(body)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderSearch() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <input aria-label="Some other field" />
      <GlobalSearch />
    </QueryClientProvider>,
  );
}

function searchBox() {
  return screen.getByRole("combobox", { name: /Search leads/ }) as HTMLInputElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  pushMock.mockClear();
});

describe("GlobalSearch", () => {
  it("asks for 2 characters and sends nothing for one", async () => {
    const fetchMock = stubFetch();
    renderSearch();
    fireEvent.focus(searchBox());
    fireEvent.change(searchBox(), { target: { value: "z" } });
    expect(await screen.findByText("Type at least 2 characters", { selector: "p" })).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 100));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("debounces: typing three letters quickly sends one request, for the final text", async () => {
    const fetchMock = stubFetch();
    renderSearch();
    fireEvent.focus(searchBox());
    for (const value of ["ze", "zep", "zeph"]) fireEvent.change(searchBox(), { target: { value } });
    await screen.findByText("Asha Rao");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/v1/search?q=zeph");
  });

  it("shows results grouped under headings, with a See-all option only for a group that has more", async () => {
    stubFetch();
    renderSearch();
    fireEvent.focus(searchBox());
    fireEvent.change(searchBox(), { target: { value: "zep" } });
    expect(await screen.findByRole("group", { name: "Leads" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Companies" })).toBeTruthy();
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual([
      "Asha RaoZephyr Foods · asha@example.test",
      "Ravi IyerZephyr Foods",
      "See all matching leads →",
      "Zephyr FoodsChennai",
    ]);
    expect(searchBox().getAttribute("aria-expanded")).toBe("true");
  });

  it("arrow keys move the highlight across groups (wrapping) and Enter opens the highlighted record", async () => {
    stubFetch();
    renderSearch();
    fireEvent.focus(searchBox());
    fireEvent.change(searchBox(), { target: { value: "zep" } });
    await screen.findByText("Asha Rao");

    fireEvent.keyDown(searchBox(), { key: "ArrowDown" });
    const first = screen.getAllByRole("option")[0]!;
    expect(first.getAttribute("aria-selected")).toBe("true");
    expect(searchBox().getAttribute("aria-activedescendant")).toBe(first.id);

    fireEvent.keyDown(searchBox(), { key: "ArrowUp" }); // wraps to the last option
    expect(screen.getAllByRole("option")[3]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(searchBox(), { key: "Enter" });
    expect(pushMock).toHaveBeenCalledWith("/companies/c1");
    expect(searchBox().value).toBe("");
  });

  it("Enter with nothing highlighted opens the top result; the See-all option goes to the filtered list", async () => {
    stubFetch();
    renderSearch();
    fireEvent.focus(searchBox());
    fireEvent.change(searchBox(), { target: { value: "zep" } });
    await screen.findByText("Asha Rao");
    fireEvent.keyDown(searchBox(), { key: "Enter" });
    expect(pushMock).toHaveBeenLastCalledWith("/leads/l1");

    fireEvent.focus(searchBox());
    fireEvent.change(searchBox(), { target: { value: "zep" } });
    fireEvent.mouseDown(await screen.findByText("See all matching leads →"));
    expect(pushMock).toHaveBeenLastCalledWith("/leads?q=zep");
  });

  it("Ctrl+K and / focus the box, but / typed into another field is left alone; Esc closes then clears", async () => {
    stubFetch();
    renderSearch();
    const other = screen.getByLabelText("Some other field");
    other.focus();
    fireEvent.keyDown(other, { key: "/" });
    expect(document.activeElement).toBe(other);

    act(() => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    });
    expect(document.activeElement).toBe(searchBox());
    searchBox().blur();
    act(() => {
      fireEvent.keyDown(document.body, { key: "/" });
    });
    expect(document.activeElement).toBe(searchBox());

    fireEvent.change(searchBox(), { target: { value: "zep" } });
    await screen.findByText("Asha Rao");
    fireEvent.keyDown(searchBox(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("Asha Rao")).toBeNull());
    expect(searchBox().value).toBe("zep");
    fireEvent.keyDown(searchBox(), { key: "Escape" });
    expect(searchBox().value).toBe("");
  });

  it("says so when nothing matches", async () => {
    stubFetch({ data: { query: "qq", groups: [] } });
    renderSearch();
    fireEvent.focus(searchBox());
    fireEvent.change(searchBox(), { target: { value: "qq" } });
    expect(await screen.findByText("No matches for “qq”", { selector: "p" })).toBeTruthy();
  });
});
