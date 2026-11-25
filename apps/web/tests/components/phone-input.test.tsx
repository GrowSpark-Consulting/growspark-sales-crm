import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { PhoneInput, splitPhone } from "@/components/ui/phone-input";

function numberBox() {
  return screen.getByRole("textbox", { name: "Phone number" }) as HTMLInputElement;
}

function countryTrigger() {
  return screen.getByRole("combobox", { name: "Country code" });
}

function paste(input: HTMLInputElement, text: string) {
  fireEvent.paste(input, { clipboardData: { getData: () => text } });
}

/** A parent that reflects onChange back into value, as react-hook-form does. */
function Controlled({ initial = "", onValue }: { initial?: string; onValue?: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <PhoneInput
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

describe("PhoneInput (D41: country-code select + number, composed into/out of one E.164 string)", () => {
  it("defaults the country code to India (+91) and the number blank when value is empty", () => {
    render(<PhoneInput value="" onChange={vi.fn()} />);
    expect(countryTrigger().textContent).toContain("India (+91)");
    expect(numberBox().value).toBe("");
  });

  it("typing digits emits a combined +91 E.164 string", () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    fireEvent.change(numberBox(), { target: { value: "9840012345" } });
    expect(onChange).toHaveBeenLastCalledWith("+919840012345");
  });

  it("clearing the number back to empty emits an empty string, not a bare country code", () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    fireEvent.change(numberBox(), { target: { value: "9840012345" } });
    fireEvent.change(numberBox(), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("splits an existing E.164 value into its country code and national number", () => {
    render(<PhoneInput value="+14155551234" onChange={vi.fn()} />);
    expect(countryTrigger().textContent).toContain("+1");
    expect(numberBox().value).toBe("4155551234");
  });

  it("re-syncs when the external value changes (e.g. the form is reset)", () => {
    const { rerender } = render(<PhoneInput value="+919840012345" onChange={vi.fn()} />);
    expect(numberBox().value).toBe("9840012345");
    rerender(<PhoneInput value="" onChange={vi.fn()} />);
    expect(numberBox().value).toBe("");
  });
});

describe("PhoneInput typing limits (D99)", () => {
  it("ignores letters and symbols as they are typed", () => {
    const onChange = vi.fn();
    render(<Controlled onValue={onChange} />);
    fireEvent.change(numberBox(), { target: { value: "98a4-0(0)" } });
    expect(numberBox().value).toBe("98400");
    expect(onChange).toHaveBeenLastCalledWith("+9198400");
    fireEvent.change(numberBox(), { target: { value: "98400x" } });
    expect(numberBox().value).toBe("98400");
    expect(onChange).toHaveBeenCalledTimes(1); // a letter alone changes nothing
  });

  it("drops a typed leading 0 (the domestic trunk prefix)", () => {
    render(<Controlled />);
    fireEvent.change(numberBox(), { target: { value: "0" } });
    expect(numberBox().value).toBe("");
    fireEvent.change(numberBox(), { target: { value: "09" } });
    expect(numberBox().value).toBe("9");
  });

  it("an 11th digit cannot be typed for India: the box keeps its 10 digits and says why", () => {
    const onChange = vi.fn();
    render(<Controlled onValue={onChange} />);
    fireEvent.change(numberBox(), { target: { value: "9840012345" } });
    onChange.mockClear();

    fireEvent.change(numberBox(), { target: { value: "98400123456" } });

    expect(numberBox().value).toBe("9840012345");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("India (+91) numbers have at most 10 digits.")).toBeTruthy();
    // A digit typed in the middle is refused the same way (nothing is pushed off the end).
    fireEvent.change(numberBox(), { target: { value: "98400712345" } });
    expect(numberBox().value).toBe("9840012345");
  });

  it("shows no digit counter (removed after D99), and no note until a digit is refused", () => {
    const { container } = render(<Controlled />);
    fireEvent.change(numberBox(), { target: { value: "9840012" } });
    expect(container.textContent).not.toMatch(/\d+\/\d+/);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("forwards the form field's id to the digits box, so its label points at it", () => {
    render(
      <>
        <label htmlFor="phone-field">Phone</label>
        <PhoneInput id="phone-field" value="" onChange={vi.fn()} />
      </>
    );
    expect(screen.getByLabelText("Phone")).toBe(numberBox());
  });
});

describe("PhoneInput paste handling (D99)", () => {
  it.each([
    ["+91 98400-12345", "9840012345", "+919840012345"],
    ["098400 12345", "9840012345", "+919840012345"],
    ["919840012345", "9840012345", "+919840012345"],
    ["0091 98400 12345", "9840012345", "+919840012345"],
  ])("cleans up %s into India and 10 digits", (text, digits, e164) => {
    const onChange = vi.fn();
    render(<Controlled onValue={onChange} />);
    paste(numberBox(), text);
    expect(numberBox().value).toBe(digits);
    expect(onChange).toHaveBeenLastCalledWith(e164);
    expect(countryTrigger().textContent).toContain("+91");
  });

  it("a pasted number with another country code switches the country", () => {
    const onChange = vi.fn();
    render(<Controlled onValue={onChange} />);
    paste(numberBox(), "+44 (0)20 7946 0958");
    expect(countryTrigger().textContent).toContain("United Kingdom (+44)");
    expect(numberBox().value).toBe("2079460958");
    expect(onChange).toHaveBeenLastCalledWith("+442079460958");
  });

  it("a paste that is still too long is refused with a message, never cut short", () => {
    const onChange = vi.fn();
    render(<Controlled initial="+9198400" onValue={onChange} />);
    paste(numberBox(), "98400 1234 5678");
    expect(numberBox().value).toBe("98400");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/numbers have at most 10\. Nothing was pasted\./)).toBeTruthy();
  });

  it("an unknown country code is refused with a message", () => {
    render(<Controlled />);
    paste(numberBox(), "+999 1234 5678");
    expect(numberBox().value).toBe("");
    expect(screen.getByText(/is not a country code in the list\. Nothing was pasted\./)).toBeTruthy();
  });

  it("pasting digits where the cursor is joins them to what was already typed", () => {
    const onChange = vi.fn();
    render(<Controlled onValue={onChange} />);
    fireEvent.change(numberBox(), { target: { value: "98400" } });
    numberBox().setSelectionRange(5, 5);
    paste(numberBox(), "12345");
    expect(numberBox().value).toBe("9840012345");
    expect(onChange).toHaveBeenLastCalledWith("+919840012345");
  });
});

describe("PhoneInput and stored values (D99)", () => {
  it("clearing the digits does not snap the country back to India (its own change echoed back is not a reset)", () => {
    render(<Controlled />);
    paste(numberBox(), "+44 20 7946 0958");
    fireEvent.change(numberBox(), { target: { value: "" } });
    expect(countryTrigger().textContent).toContain("+44");
  });

  it("an older stored value that needs cleaning up is shown cleaned and sent up once, so what is shown is what is saved", () => {
    const onChange = vi.fn();
    render(<PhoneInput value="09840012345" onChange={onChange} />);
    expect(numberBox().value).toBe("9840012345");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("+919840012345");
  });

  it("a clean stored value is not re-sent on load", () => {
    const onChange = vi.fn();
    render(<PhoneInput value="+919840012345" onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("splitPhone reads stored values, including older free text", () => {
    expect(splitPhone("+914423456789")).toEqual({ countryCode: "+91", number: "4423456789" });
    expect(splitPhone("+91 44 4000 1234")).toEqual({ countryCode: "+91", number: "4440001234", cleanedUp: true });
    expect(splitPhone("")).toEqual({ countryCode: "+91", number: "" });
  });
});
