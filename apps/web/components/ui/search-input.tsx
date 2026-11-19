"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

export interface SearchInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
  onSearch: (value: string) => void;
}

/**
 * Reusable search box: a magnifier icon inside the field runs the search
 * (same as pressing Enter), and a clear (x) button appears once there's
 * text, clearing it and re-running the search with an empty value. Used by
 * Users today; Leads/Companies/Contacts should reuse this rather than
 * rebuilding the pattern.
 */
export function SearchInput({
  value,
  onValueChange,
  onSearch,
  placeholder,
  className,
  "aria-label": ariaLabel,
  ...props
}: SearchInputProps) {
  function runSearch() {
    onSearch(value.trim());
  }

  function handleClear() {
    onValueChange("");
    onSearch("");
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={runSearch}
        aria-label="Search"
        className="absolute inset-y-0 left-0 flex w-9 items-center justify-center text-ink-muted hover:text-ink"
      >
        <Search className="size-(--icon-md)" aria-hidden="true" />
      </button>
      <Input
        type="text"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            runSearch();
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn("pl-9", value ? "pr-9" : "pr-3")}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-muted hover:text-ink"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
