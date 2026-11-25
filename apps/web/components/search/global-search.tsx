"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH } from "@growspark/shared";
import { cn } from "cn";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useGlobalSearch } from "@/hooks/use-search";

export const SEARCH_DEBOUNCE_MS = 250;

interface Option {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  kind: "result" | "see-all";
}

/** True when the keystroke is going into something the user is typing in, so "/" must not be stolen. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * The top-bar search (D94): an ARIA combobox over GET /search. Debounced,
 * grouped by record type, keyboard-first — Ctrl+K (⌘K) or "/" focuses it,
 * ↑/↓ move, Enter opens, Esc closes (a second Esc clears).
 */
export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  // The highlight belongs to one set of results: it is stored with the query
  // it was made for, so new results start with nothing highlighted.
  const [highlight, setHighlight] = useState<{ query: string; index: number }>({ query: "", index: -1 });

  const trimmed = value.trim();
  const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  const query = useGlobalSearch(debounced);
  const activeIndex = highlight.query === debounced ? highlight.index : -1;
  const setActiveIndex = (next: number | ((current: number) => number)) =>
    setHighlight({ query: debounced, index: typeof next === "function" ? next(activeIndex) : next });
  const tooShort = trimmed.length > 0 && trimmed.length < SEARCH_MIN_LENGTH;
  const groups = useMemo(
    () => (trimmed.length >= SEARCH_MIN_LENGTH ? query.data?.data.groups ?? [] : []),
    [query.data, trimmed.length],
  );

  // One flat list in display order, so ↑/↓ can walk across groups.
  const options = useMemo(() => {
    const flat: (Option & { groupIndex: number })[] = [];
    groups.forEach((group, groupIndex) => {
      for (const result of group.results) {
        flat.push({ ...result, id: `${group.type}-${result.id}`, kind: "result", groupIndex });
      }
      if (group.hasMore) {
        flat.push({
          id: `${group.type}-see-all`,
          href: group.seeAllHref,
          title: `See all matching ${group.label.toLowerCase()}`,
          subtitle: "",
          kind: "see-all",
          groupIndex,
        });
      }
    });
    return flat;
  }, [groups]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      const isSlash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !isTypingTarget(event.target);
      if (isShortcut || isSlash) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(option: Option) {
    setOpen(false);
    setValue("");
    setActiveIndex(-1);
    inputRef.current?.blur();
    router.push(option.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (options.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        if (current === -1) return step === 1 ? 0 : options.length - 1;
        return (current + step + options.length) % options.length;
      });
    } else if (event.key === "Enter") {
      // With nothing highlighted, Enter opens the top result — but only once the
      // results on screen are for exactly what is typed, never stale ones.
      const option = activeIndex >= 0 ? options[activeIndex] : debounced === trimmed ? options[0] : undefined;
      if (option) {
        event.preventDefault();
        go(option);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (open && trimmed) {
        setOpen(false);
      } else {
        setValue("");
        inputRef.current?.blur();
      }
    }
  }

  const showPanel = open && trimmed.length > 0;
  const searching = !tooShort && (debounced !== trimmed || query.isFetching) && groups.length === 0;
  let status = "";
  if (tooShort) status = `Type at least ${SEARCH_MIN_LENGTH} characters`;
  else if (searching) status = "Searching…";
  else if (query.isError) status = "Search failed. Try again.";
  else if (debounced === trimmed && query.isSuccess && groups.length === 0) status = `No matches for “${trimmed}”`;
  else if (groups.length > 0) {
    const count = groups.reduce((sum, group) => sum + group.results.length, 0);
    status = `${count} result${count === 1 ? "" : "s"}. Use the up and down arrows to choose.`;
  }

  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;

  return (
    <div className="relative w-full max-w-sm">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search leads, contacts, companies, deals and quotations"
        aria-expanded={showPanel && options.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? `${baseId}-${activeOption.id}` : undefined}
        autoComplete="off"
        spellCheck={false}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder="Search…  Ctrl+K"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="h-(--control-md) w-full rounded-md border border-line bg-surface pr-3 pl-8 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1"
      />
      <div role="status" aria-live="polite" className="sr-only">
        {showPanel ? status : ""}
      </div>
      {showPanel && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-md">
          {options.length === 0 && <p className="px-3 py-2 text-sm text-ink-muted">{status}</p>}
          <ul id={listboxId} role="listbox" aria-label="Search results" className={options.length === 0 ? "hidden" : undefined}>
            {groups.map((group, groupIndex) => {
              const headingId = `${baseId}-group-${group.type}`;
              return (
                <li key={group.type} role="presentation">
                  <div id={headingId} className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-ink-muted uppercase">
                    {group.label}
                  </div>
                  <ul role="group" aria-labelledby={headingId}>
                    {options
                      .map((option, index) => ({ option, index }))
                      .filter(({ option }) => option.groupIndex === groupIndex)
                      .map(({ option, index }) => (
                        <li
                          key={option.id}
                          id={`${baseId}-${option.id}`}
                          role="option"
                          aria-selected={index === activeIndex}
                          // mousedown, not click: keeps focus in the input so its onBlur doesn't close the list first.
                          onMouseDown={(event) => {
                            event.preventDefault();
                            go(option);
                          }}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={cn(
                            "cursor-pointer px-3 py-1.5",
                            index === activeIndex && "bg-surface-hover",
                            option.kind === "see-all" && "text-sm text-primary",
                          )}
                        >
                          {option.kind === "result" ? (
                            <>
                              <span className="block truncate text-sm text-ink">{option.title}</span>
                              {option.subtitle && (
                                <span className="block truncate text-xs text-ink-muted">{option.subtitle}</span>
                              )}
                            </>
                          ) : (
                            <span>{option.title} →</span>
                          )}
                        </li>
                      ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
