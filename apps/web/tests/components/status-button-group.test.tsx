import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { StatusButtonGroup, type StatusOption } from "@/components/ui/status-button-group";
import { ApiError } from "@/lib/api-client";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type Status = "NEW" | "CONTACTED" | "QUALIFIED";
const OPTIONS: StatusOption<Status>[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
];

/** A promise the test settles by hand, so the "saving" moment can be inspected. */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("StatusButtonGroup (D105)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the current status as the selected button and clicking it changes nothing", () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    render(<StatusButtonGroup groupLabel="Change status" options={OPTIONS} current="NEW" onSelect={onSelect} />);

    expect(screen.getByRole("button", { name: "New" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Contacted" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("buttons are pointer-cursor with hover, active and keyboard-focus styles", () => {
    render(<StatusButtonGroup groupLabel="Change status" options={OPTIONS} current="NEW" onSelect={vi.fn()} />);
    const other = screen.getByRole("button", { name: "Contacted" }).className;
    expect(other).toContain("cursor-pointer");
    expect(other).toContain("hover:bg-surface-hover");
    expect(other).toContain("active:bg-surface-sunken");
    expect(other).toContain("focus-visible:outline-2");
    expect(other).toContain("focus-visible:outline-(--focus-ring)");
  });

  it("while saving: a spinner on the clicked button only, every button disabled, a second click does nothing; then the new status is selected with a toast", async () => {
    const save = deferred();
    const onSelect = vi.fn(() => save.promise);
    render(<StatusButtonGroup groupLabel="Change status" options={OPTIONS} current="NEW" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Contacted" }));
    expect(onSelect).toHaveBeenCalledWith("CONTACTED");

    const group = screen.getByRole("group", { name: "Change status" });
    expect(group.getAttribute("aria-busy")).toBe("true");
    expect(within(screen.getByRole("button", { name: "Contacted" })).getByTestId("status-spinner")).toBeTruthy();
    expect(screen.getAllByTestId("status-spinner")).toHaveLength(1);
    for (const button of within(group).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Qualified" }));
    fireEvent.click(screen.getByRole("button", { name: "Contacted" }));
    expect(onSelect).toHaveBeenCalledTimes(1);

    save.resolve();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Status changed to Contacted"));
    await waitFor(() => expect(screen.queryByTestId("status-spinner")).toBeNull());
    expect(screen.getByRole("button", { name: "Contacted" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "New" }).getAttribute("aria-pressed")).toBe("false");
    for (const button of within(group).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on failure: an error toast with the server's message, the previous status stays selected, buttons are usable again", async () => {
    const onSelect = vi.fn().mockRejectedValue(new ApiError(409, "INVALID_STATUS_TRANSITION", "A converted lead cannot change status."));
    render(<StatusButtonGroup groupLabel="Change status" options={OPTIONS} current="NEW" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Qualified" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A converted lead cannot change status."));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "New" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("button", { name: "Qualified" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("a non-API failure uses the group's own error text", async () => {
    render(
      <StatusButtonGroup groupLabel="g" options={OPTIONS} current="NEW" onSelect={vi.fn().mockRejectedValue(new Error("boom"))} errorMessage="Could not change status. Please try again." />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Contacted" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not change status. Please try again."));
  });

  it("when the refetched record brings a new current status, that replaces the optimistic selection", async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<StatusButtonGroup groupLabel="g" options={OPTIONS} current="NEW" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Contacted" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Contacted" }).getAttribute("aria-pressed")).toBe("true"));

    rerender(<StatusButtonGroup groupLabel="g" options={OPTIONS} current="QUALIFIED" onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: "Qualified" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Contacted" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("an option with a confirmation asks first: the call is made only from the dialog, whose button shows the spinner", async () => {
    const save = deferred();
    const onSelect = vi.fn(() => save.promise);
    const options: StatusOption<Status>[] = [
      { value: "NEW", label: "New" },
      { value: "QUALIFIED", label: "Qualify", statusLabel: "Qualified", confirm: { title: "Qualify this?", description: "Final.", confirmLabel: "Yes, qualify" } },
    ];
    render(<StatusButtonGroup groupLabel="g" options={options} current="NEW" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Qualify" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Qualify this?")).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Yes, qualify" }));
    expect(onSelect).toHaveBeenCalledWith("QUALIFIED");
    expect(within(screen.getByRole("dialog")).getByTestId("status-spinner")).toBeTruthy();
    expect((within(screen.getByRole("dialog")).getByRole("button", { name: "Working…" }) as HTMLButtonElement).disabled).toBe(true);

    save.resolve();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Status changed to Qualified"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("a failure inside a confirmation dialog stays in the dialog (existing error banner), with no success toast", async () => {
    const options: StatusOption<Status>[] = [
      { value: "NEW", label: "New" },
      { value: "QUALIFIED", label: "Qualify", confirm: { title: "Qualify this?", description: "Final.", confirmLabel: "Yes, qualify" } },
    ];
    render(
      <StatusButtonGroup
        groupLabel="g"
        options={options}
        current="NEW"
        onSelect={vi.fn().mockRejectedValue(new ApiError(409, "CONFLICT", "This quotation changed at the same time."))}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Qualify" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes, qualify" }));
    expect(await screen.findByText("This quotation changed at the same time.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("without a current status (pure actions) every button is a plain action, and a custom success text can be used", async () => {
    const actions: StatusOption<string>[] = [{ value: "complete", label: "Complete", statusLabel: "Completed" }, { value: "cancel", label: "Cancel", statusLabel: "Cancelled" }];
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<StatusButtonGroup groupLabel="g" options={actions} onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: "Complete" }).getAttribute("aria-pressed")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Status changed to Completed"));
    unmount();

    render(<StatusButtonGroup groupLabel="g" options={actions} onSelect={onSelect} successMessage={(option) => `${option.label} done`} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cancel done"));
  });
});
