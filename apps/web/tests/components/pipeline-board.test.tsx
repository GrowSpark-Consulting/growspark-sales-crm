import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PipelineBoard } from "@/components/deals/pipeline-board";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function dealFixture(stageId: string) {
  return {
    id: "deal-a",
    name: "Deal A",
    companyId: "co-1",
    pipelineId: "pipe-1",
    stageId,
    value: "100000",
    currency: "INR",
    probability: stageId === "stage-1" ? 10 : 50,
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
}

const stages = [
  { id: "stage-1", pipelineId: "pipe-1", name: "Qualification", position: 1, probability: 10, type: "OPEN" },
  { id: "stage-2", pipelineId: "pipe-1", name: "Proposal", position: 2, probability: 50, type: "OPEN" },
];

/**
 * A small stateful fake backend — the deal genuinely moves (or doesn't, on
 * a forced failure) server-side, so asserting against either the immediate
 * optimistic state or the post-invalidation refetched state gives the same,
 * consistent answer, the same way a real API would.
 */
function stubFetch({ failMove }: { failMove: boolean }) {
  let currentStageId = "stage-1";

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/pipeline/stages")) return Promise.resolve(jsonResponse(200, { data: stages }));
      if (url.includes("/pipeline/summary")) {
        return Promise.resolve(
          jsonResponse(200, { data: { stages: [], open: { count: 0, totalValue: "0", weightedValue: "0" } } }),
        );
      }
      if (url.includes("/users/options")) return Promise.resolve(jsonResponse(200, { data: [] }));
      if (url.includes("/companies")) return Promise.resolve(jsonResponse(200, { data: [], meta: { page: 1, pageSize: 100, total: 0 } }));
      if (url.includes("/deals/deal-a/stage") && init?.method === "POST") {
        if (failMove) {
          return Promise.resolve(jsonResponse(500, { error: { code: "INTERNAL", message: "Something went wrong." } }));
        }
        const body = JSON.parse(init.body as string) as { stageId: string };
        currentStageId = body.stageId;
        return Promise.resolve(jsonResponse(200, { data: dealFixture(currentStageId) }));
      }
      if (url.includes("/deals?")) {
        const requestedStage = new URL(url, "http://localhost").searchParams.get("stageId");
        const data = requestedStage === currentStageId ? [dealFixture(currentStageId)] : [];
        return Promise.resolve(jsonResponse(200, { data, meta: { page: 1, pageSize: 100, total: data.length } }));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    }),
  );
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

async function openMoveMenuAndPick(cardName: string, targetStageName: string) {
  // The card's own root <div> (BoardCard) is the nearest div ancestor of its
  // name link — one level up from that reaches the column's shared card
  // container instead, which would be wrong once a column holds more than
  // one card.
  const card = (await screen.findByText(cardName)).closest("div") as HTMLElement;
  const trigger = within(card).getByRole("button", { name: /Move to/ });
  // Radix's dropdown trigger opens on pointerdown in real browsers; jsdom
  // has no PointerEvent support for that, so this opens it via keyboard
  // activation instead (Enter), which every Radix trigger also supports.
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
  const menu = await screen.findByRole("menu");
  fireEvent.click(within(menu).getByText(targetStageName));
}

describe("PipelineBoard dropdown fallback (package 3.4: moving via the dropdown calls the stage endpoint and updates the column)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a successful move calls POST /deals/:id/stage and the deal ends up in the target column", async () => {
    stubFetch({ failMove: false });
    renderWithClient(<PipelineBoard />);

    await screen.findByText("Qualification");
    await openMoveMenuAndPick("Deal A", "Proposal");

    await waitFor(async () => {
      const proposalHeading = await screen.findByText("Proposal");
      const proposalColumn = proposalHeading.closest("div")!.parentElement as HTMLElement;
      expect(within(proposalColumn).queryByText("Deal A")).toBeTruthy();
    });

    const qualificationHeading = await screen.findByText("Qualification");
    const qualificationColumn = qualificationHeading.closest("div")!.parentElement as HTMLElement;
    await waitFor(() => expect(within(qualificationColumn).queryByText("Deal A")).toBeNull());

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/deals/deal-a/stage",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("a failed move rolls back — the deal stays in its original column", async () => {
    stubFetch({ failMove: true });
    renderWithClient(<PipelineBoard />);

    await screen.findByText("Qualification");
    await openMoveMenuAndPick("Deal A", "Proposal");

    // Give the optimistic update + failed mutation + rollback a tick to settle.
    await waitFor(() => expect(screen.getByText("Deal A")).toBeTruthy());

    const qualificationHeading = await screen.findByText("Qualification");
    const qualificationColumn = qualificationHeading.closest("div")!.parentElement as HTMLElement;
    await waitFor(() => expect(within(qualificationColumn).queryByText("Deal A")).toBeTruthy());

    const proposalHeading = await screen.findByText("Proposal");
    const proposalColumn = proposalHeading.closest("div")!.parentElement as HTMLElement;
    expect(within(proposalColumn).queryByText("Deal A")).toBeNull();
  });
});
