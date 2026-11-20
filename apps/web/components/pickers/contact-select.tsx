"use client";

import { useId, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { useContactsList } from "@/hooks/use-contacts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface ContactSelectProps {
  value: { id: string; name: string } | undefined;
  onValueChange: (value: { id: string; name: string } | undefined) => void;
  /** Narrows the search to one company's contacts — used on a deal already linked to a company. */
  companyId?: string;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * Async contact search-and-pick, the same hand-built combobox pattern as
 * CompanySelect (D37) — no Combobox primitive is installed, and a second one
 * for this one picker wasn't judged worth a new dependency (package 3.3).
 */
export function ContactSelect({
  value,
  onValueChange,
  companyId,
  placeholder = "Search contacts…",
  className,
  ...props
}: ContactSelectProps) {
  const listboxId = useId();
  const [inputValue, setInputValue] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const [syncedValueId, setSyncedValueId] = useState(value?.id);
  if (value?.id !== syncedValueId) {
    setSyncedValueId(value?.id);
    setInputValue(value?.name ?? "");
  }

  const debouncedQuery = useDebouncedValue(inputValue, 300);
  const searchActive = open && debouncedQuery.trim().length > 0 && debouncedQuery !== value?.name;

  const { data, isFetching } = useContactsList({
    q: debouncedQuery.trim(),
    companyId,
    pageSize: 10,
    sort: "firstName:asc",
  });
  const results = searchActive ? (data?.data ?? []) : [];

  const [highlightedForQuery, setHighlightedForQuery] = useState(debouncedQuery);
  if (debouncedQuery !== highlightedForQuery) {
    setHighlightedForQuery(debouncedQuery);
    setHighlightedIndex(0);
  }

  function contactName(contact: { firstName: string; lastName: string | null }): string {
    return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  }

  function selectContact(contact: { id: string; name: string }) {
    onValueChange(contact);
    setInputValue(contact.name);
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
      const contact = results[highlightedIndex];
      if (contact) selectContact({ id: contact.id, name: contactName(contact) });
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
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
            results.map((contact, index) => (
              <li
                key={contact.id}
                role="option"
                aria-selected={value?.id === contact.id}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectContact({ id: contact.id, name: contactName(contact) });
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between px-3 py-2 text-sm",
                  index === highlightedIndex ? "bg-surface-hover" : undefined
                )}
              >
                {contactName(contact)}
                {value?.id === contact.id && <Check className="size-4 text-primary" aria-hidden="true" />}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
