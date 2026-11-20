import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhoneInput } from "@/components/ui/phone-input";

describe("PhoneInput (D41: country-code select + number, composed into/out of one E.164 string)", () => {
  it("defaults the country code to +91 and the number blank when value is empty", () => {
    render(<PhoneInput value="" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Country code" }).textContent).toContain("+91");
    expect((screen.getByRole("textbox", { name: "Phone number" }) as HTMLInputElement).value).toBe("");
  });

  it("typing digits emits a combined +91 E.164 string", () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "9840012345" } });

    expect(onChange).toHaveBeenLastCalledWith("+919840012345");
  });

  it("strips spaces before emitting", () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "98400 12345" } });

    expect(onChange).toHaveBeenLastCalledWith("+919840012345");
  });

  it("clearing the number back to empty emits an empty string, not a bare country code", () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);

    const number = screen.getByRole("textbox", { name: "Phone number" });
    fireEvent.change(number, { target: { value: "9840012345" } });
    fireEvent.change(number, { target: { value: "" } });

    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("splits an existing E.164 value into its country code and national number", () => {
    render(<PhoneInput value="+14155551234" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Country code" }).textContent).toContain("+1");
    expect((screen.getByRole("textbox", { name: "Phone number" }) as HTMLInputElement).value).toBe("4155551234");
  });

  it("re-syncs when the external value changes (e.g. the form is reset)", () => {
    const { rerender } = render(<PhoneInput value="+919840012345" onChange={vi.fn()} />);
    expect((screen.getByRole("textbox", { name: "Phone number" }) as HTMLInputElement).value).toBe("9840012345");

    rerender(<PhoneInput value="" onChange={vi.fn()} />);
    expect((screen.getByRole("textbox", { name: "Phone number" }) as HTMLInputElement).value).toBe("");
  });
});
