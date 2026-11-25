"use client";

import { useId, useState } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

/** How many options a picker shows before the "type to search more" hint (D97). */
export const PICKER_PAGE_SIZE = 20;

export interface RecordOption {
  id: string;
  /** The text shown in the box once picked. */
  name: string;
  /** Optional grey second line (e.g. a contact's email) to tell same-named records apart. */
  description?: string | null;
}

export interface RecordOptionsPage {
  options: RecordOption[];
  /** How many records match in total — more than `options.length` shows the hint. */
  total: number;
}

export interface RecordComboboxProps {
  value: { id: string; name: string } | undefined;
  onValueChange: (value: { id: string; name: string } | undefined) => void;
  /**
   * Cache key prefix for this picker's queries. Put the record type's own
   * query-key root first (e.g. "companies") so the existing invalidations
   * after a create/edit also refresh the picker.
   */
  queryKeyPrefix: QueryKey;
  /** Loads one page of options; `query` is "" when nothing is typed (show the first page). */
  loadOptions: (query: string) => Promise<RecordOptionsPage>;
  /** For list filters: a first option (e.g. "Any company") that clears the value. */
  clearOption?: string;
  /**
   * For list filters: typing does not clear the current value (so the list
   * doesn't jump while searching); leaving the box without picking puts the
   * current value's name back. Forms leave this off: typing clears the pick.
   */
  keepValueWhileTyping?: boolean;
  /** Nouns for the status line, e.g. { one: "company", many: "companies" }. */
  noun: { one: string; many: string };
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}

type Row = { kind: "clear" } | { kind: "option"; option: RecordOption };

/**
 * D97: the one search-and-pick dropdown behind CompanySelect, ContactSelect
 * and the list pages' company filter. Opening it (click, focus or ↓) shows
 * the first PICKER_PAGE_SIZE records A–Z straight away; typing narrows the
 * list through the record type's existing `?q=` search (debounced 300 ms).
 * No Combobox primitive is installed (radix-ui ships Select only), so this is
 * hand-built: an input with role="combobox", aria-activedescendant pointing
 * at the highlighted option, and a listbox.
 *
 * Keyboard (WAI-ARIA editable combobox pattern): ↓/↑ open the list and move
 * the highlight, Enter picks, Esc closes, Tab leaves. Home/End keep moving
 * the text cursor, as that pattern recommends for an editable box.
 */
export function RecordCombobox({
  value,
  onValueChange,
  queryKeyPrefix,
  loadOptions,
  clearOption,
  keepValueWhileTyping = false,
  noun,
  placeholder,
  disabled,
  className,
  id,
  ...aria
}: RecordComboboxProps) {
  const listboxId = useId();
  const optionIdPrefix = useId();
  const [inputValue, setInputValue] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Several forms store only the id and look the name up afterwards, so right
  // after a pick `value.name` can still be "" (found in D98: the box used to
  // blank itself). The name this picker just picked stands in until the
  // form's own name arrives.
  const [picked, setPicked] = useState<{ id: string; name: string } | undefined>(undefined);
  const valueName = value ? value.name || (picked?.id === value.id ? picked.name : "") : "";

  // Adjusted during render, not an Effect (D37): keeps the text in sync when
  // the value changes from outside (form reset, URL change) or its name
  // arrives late.
  const syncKey = value ? `${value.id}\u0000${valueName}` : "";
  const [syncedKey, setSyncedKey] = useState(syncKey);
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey);
    setInputValue(valueName);
  }

  // Text that is just the picked record's name is not a search: reopening a
  // filled picker shows the whole first page, not one match.
  const typed = value && inputValue === valueName ? "" : inputValue.trim();
  const query = useDebouncedValue(typed, 300);

  const optionsQuery = useQuery({
    queryKey: [...queryKeyPrefix, "picker", query],
    queryFn: () => loadOptions(query),
    enabled: open && !disabled,
    // Reopening within 30 s is instant; a slow server never blanks the list
    // while the next search runs (the previous page stays until it lands).
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  const options = optionsQuery.data?.options ?? [];
  const total = optionsQuery.data?.total ?? 0;
  const firstLoad = optionsQuery.isPending && optionsQuery.fetchStatus !== "idle";
  // Searching = a fetch is running, or the user typed something the debounced
  // query hasn't caught up with yet.
  const searching = !firstLoad && (optionsQuery.isFetching || typed !== query);

  const rows: Row[] = [
    ...(clearOption ? [{ kind: "clear" } as const] : []),
    ...options.map((option) => ({ kind: "option", option }) as const),
  ];

  const [highlightedForQuery, setHighlightedForQuery] = useState(query);
  if (query !== highlightedForQuery) {
    setHighlightedForQuery(query);
    setHighlightedIndex(0);
  }
  const activeIndex = Math.min(highlightedIndex, Math.max(rows.length - 1, 0));

  function pick(row: Row) {
    if (row.kind === "clear") {
      onValueChange(undefined);
      setInputValue("");
    } else {
      setPicked({ id: row.option.id, name: row.option.name });
      onValueChange({ id: row.option.id, name: row.option.name });
      setInputValue(row.option.name);
    }
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (rows.length === 0) return;
      setHighlightedIndex(
        event.key === "ArrowDown" ? Math.min(activeIndex + 1, rows.length - 1) : Math.max(activeIndex - 1, 0)
      );
    } else if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      const row = rows[activeIndex];
      if (row && !firstLoad) pick(row);
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  const showList = open && !disabled;
  const activeDescendant = showList && rows.length > 0 && !firstLoad ? `${optionIdPrefix}-${activeIndex}` : undefined;

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant}
        aria-label={aria["aria-label"] ?? placeholder}
        aria-invalid={aria["aria-invalid"]}
        aria-describedby={aria["aria-describedby"]}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        className="pr-8"
        value={inputValue}
        onChange={(event) => {
          setInputValue(event.target.value);
          setOpen(true);
          if (!keepValueWhileTyping && value && event.target.value !== valueName) {
            onValueChange(undefined);
          }
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          if (keepValueWhileTyping) setInputValue(valueName);
        }}
        onKeyDown={handleKeyDown}
      />
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      {showList && (
        <div className="absolute z-(--z-dropdown) mt-1 w-full overflow-hidden rounded-md border border-line bg-surface shadow-md">
          <ul id={listboxId} role="listbox" aria-label={aria["aria-label"] ?? placeholder} className="max-h-60 overflow-auto py-1">
            {!firstLoad &&
              rows.map((row, index) => {
                const selected = row.kind === "clear" ? !value : value?.id === row.option.id;
                return (
                  <li
                    key={row.kind === "clear" ? "__clear" : row.option.id}
                    id={`${optionIdPrefix}-${index}`}
                    role="option"
                    aria-selected={selected}
                    // onMouseDown (not onClick) fires before the input's
                    // onBlur, so the pick registers before the list closes.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      pick(row);
                    }}
                    onMouseMove={() => setHighlightedIndex(index)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm",
                      index === activeIndex ? "bg-surface-hover" : undefined
                    )}
                  >
                    {row.kind === "clear" ? (
                      <span className="text-ink-muted">{clearOption}</span>
                    ) : (
                      <span className="min-w-0">
                        <span className="block truncate text-ink">{row.option.name}</span>
                        {row.option.description && (
                          <span className="block truncate text-xs text-ink-muted">{row.option.description}</span>
                        )}
                      </span>
                    )}
                    {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                  </li>
                );
              })}
          </ul>
          <div className="border-t border-line px-3 py-1.5 text-xs text-ink-muted" aria-live="polite">
            {firstLoad ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Loading…
              </span>
            ) : optionsQuery.isError ? (
              <span className="text-danger">Could not load {noun.many}. Close and reopen to try again.</span>
            ) : searching ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Searching…
              </span>
            ) : options.length === 0 ? (
              query ? `No ${noun.many} match "${query}".` : `No ${noun.many} yet.`
            ) : total > options.length ? (
              `Showing ${options.length} of ${total} · type to search more`
            ) : (
              `${total} ${total === 1 ? noun.one : noun.many}`
            )}
          </div>
        </div>
      )}
    </div>
  );
}
