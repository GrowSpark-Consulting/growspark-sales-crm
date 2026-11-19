"use client";

import { useId, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { useCompaniesList } from "@/hooks/use-companies";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface CompanySelectProps {
  value: { id: string; name: string } | undefined;
  onValueChange: (value: { id: string; name: string } | undefined) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * Async company search-and-pick: types into a text field, debounced 300ms
 * into GET /companies?q=..., picks a result from the dropdown. No Combobox
 * primitive is installed in this repo (radix-ui ships Select, not a
 * command/combobox), so this is a small hand-built one — a text input with
 * role="combobox" plus a listbox, not a second new dependency for one
 * picker.
 */
export function CompanySelect({
  value,
  onValueChange,
  placeholder = "Search companies…",
  className,
  ...props
}: CompanySelectProps) {
  const listboxId = useId();
  const [inputValue, setInputValue] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Adjusted during render, not an Effect (React's own recommended pattern
  // for "state derived from a prop change" — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes):
  // keeps the field's text in sync if the selected value changes from
  // outside (e.g. the form is reset), without the extra render an Effect
  // would cost.
  const [syncedValueId, setSyncedValueId] = useState(value?.id);
  if (value?.id !== syncedValueId) {
    setSyncedValueId(value?.id);
    setInputValue(value?.name ?? "");
  }

  const debouncedQuery = useDebouncedValue(inputValue, 300);
  const searchActive = open && debouncedQuery.trim().length > 0 && debouncedQuery !== value?.name;

  const { data, isFetching } = useCompaniesList({
    q: debouncedQuery.trim(),
    pageSize: 10,
    sort: "name:asc",
  });
  const results = searchActive ? (data?.data ?? []) : [];

  // Same pattern: reset the highlighted option whenever the query that
  // produced the current result set changes.
  const [highlightedForQuery, setHighlightedForQuery] = useState(debouncedQuery);
  if (debouncedQuery !== highlightedForQuery) {
    setHighlightedForQuery(debouncedQuery);
    setHighlightedIndex(0);
  }

  function selectCompany(company: { id: string; name: string }) {
    onValueChange(company);
    setInputValue(company.name);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const company = results[highlightedIndex];
      if (company) selectCompany({ id: company.id, name: company.name });
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-label={props["aria-label"] ?? placeholder}
        placeholder={placeholder}
        value={inputValue}
        onChange={(event) => {
          setInputValue(event.target.value);
          setOpen(true);
          if (value && event.target.value !== value.name) {
            onValueChange(undefined);
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {open && (isFetching || results.length > 0) && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-(--z-dropdown) mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-md"
        >
          {isFetching && <li className="px-3 py-2 text-sm text-ink-muted">Searching…</li>}
          {!isFetching &&
            results.map((company, index) => (
              <li
                key={company.id}
                role="option"
                aria-selected={value?.id === company.id}
                // onMouseDown (not onClick) fires before the input's onBlur,
                // so the selection registers before the dropdown closes.
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectCompany({ id: company.id, name: company.name });
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between px-3 py-2 text-sm",
                  index === highlightedIndex ? "bg-surface-hover" : undefined
                )}
              >
                {company.name}
                {value?.id === company.id && <Check className="size-4 text-primary" aria-hidden="true" />}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
