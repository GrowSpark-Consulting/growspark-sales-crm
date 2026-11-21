import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumericInput } from "@/components/ui/numeric-input";

describe("NumericInput", () => {
  it("keeps leading zeroes while typing and backspacing, and allows clearing", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<NumericInput aria-label="Amount" value="" onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    fireEvent.change(input, { target: { value: "056677" } });
    expect(onValueChange).toHaveBeenLastCalledWith("056677");
    rerender(<NumericInput aria-label="Amount" value="056677" onValueChange={onValueChange} />);
    fireEvent.change(input, { target: { value: "05667" } });
    expect(onValueChange).toHaveBeenLastCalledWith("05667");
    fireEvent.change(input, { target: { value: "" } });
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });
});
