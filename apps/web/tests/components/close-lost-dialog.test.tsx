import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { CloseLostDialog } from "@/components/deals/close-lost-dialog";

describe("CloseLostDialog (package 3.3: a deal cannot be marked Lost without a reason)", () => {
  it("the dialog's submit button is disabled until a reason is chosen", async () => {
    render(<CloseLostDialog onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Close as Lost" }));

    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Close as Lost" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("the reason select starts with nothing chosen (no reason defaulted or guessed)", async () => {
    render(<CloseLostDialog onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Close as Lost" }));

    const reasonTrigger = await screen.findByRole("combobox", { name: "Lost reason" });
    expect(reasonTrigger.textContent).not.toMatch(/Price|Competitor|No budget|No decision|Timing|Not a fit|Unresponsive|Other/);
  });
});
