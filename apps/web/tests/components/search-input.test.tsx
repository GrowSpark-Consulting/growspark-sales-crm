import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchInput } from "@/components/ui/search-input";

describe("SearchInput", () => {
  it("runs the search on Enter", () => {
    const onSearch = vi.fn();
    render(<SearchInput value="acme" onValueChange={() => {}} onSearch={onSearch} placeholder="Search" />);

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });

    expect(onSearch).toHaveBeenCalledWith("acme");
  });

  it("runs the search when the magnifier button is clicked", () => {
    const onSearch = vi.fn();
    render(<SearchInput value="acme" onValueChange={() => {}} onSearch={onSearch} placeholder="Search" />);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(onSearch).toHaveBeenCalledWith("acme");
  });

  it("shows a clear button only once there is text, and clearing resets and re-searches empty", () => {
    const onValueChange = vi.fn();
    const onSearch = vi.fn();
    const { rerender } = render(
      <SearchInput value="" onValueChange={onValueChange} onSearch={onSearch} placeholder="Search" />,
    );
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

    rerender(<SearchInput value="acme" onValueChange={onValueChange} onSearch={onSearch} placeholder="Search" />);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(onValueChange).toHaveBeenCalledWith("");
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("trims whitespace before searching", () => {
    const onSearch = vi.fn();
    render(<SearchInput value="  acme  " onValueChange={() => {}} onSearch={onSearch} placeholder="Search" />);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(onSearch).toHaveBeenCalledWith("acme");
  });
});
