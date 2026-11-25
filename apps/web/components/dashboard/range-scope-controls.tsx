"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useListUrlState } from "@/hooks/use-list-url-state";

type Range = "month" | "30d" | "custom";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The date-range + All/Mine filter shared by Home and Reports (D92), kept in
 * the URL (`range`, `from`, `to`, `scope`) so both pages read it the same
 * way. "This month" sends no dates: the server's own default is the
 * organisation's current calendar month.
 */
export function useRangeScope() {
  const { searchParams, setParams } = useListUrlState();
  const scope: "all" | "mine" = searchParams.get("scope") === "mine" ? "mine" : "all";
  const range: Range =
    searchParams.get("range") === "30d" ? "30d" : searchParams.get("range") === "custom" ? "custom" : "month";
  const customFrom = searchParams.get("from") ?? "";
  const customTo = searchParams.get("to") ?? "";
  // "Now" is read once per mount via a lazy useState initializer — the
  // sanctioned way to capture an impure value (the current date) without
  // calling `new Date()`/`Date.now()` directly in the render body, which the
  // React Compiler's purity check (`react-hooks/purity`) flags as an error.
  const [now] = useState(() => new Date());

  const { from, to } =
    range === "30d"
      ? { from: isoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), to: isoDate(now) }
      : range === "custom"
        ? { from: customFrom || undefined, to: customTo || undefined }
        : { from: undefined, to: undefined };

  return { scope, range, customFrom, customTo, from, to, setParams };
}

export function RangeScopeControls({
  state,
  idPrefix,
  scopeLabel,
}: {
  state: ReturnType<typeof useRangeScope>;
  idPrefix: string;
  scopeLabel: string;
}) {
  const { scope, range, customFrom, customTo, setParams } = state;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="label text-ink-muted" htmlFor={`${idPrefix}-range`}>
          Date range
        </label>
        <Select value={range} onValueChange={(value) => setParams({ range: value === "month" ? undefined : value })}>
          <SelectTrigger id={`${idPrefix}-range`} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {range === "custom" && (
        <div className="flex items-center gap-1">
          <Input
            type="date"
            aria-label="From date"
            value={customFrom}
            onChange={(event) => setParams({ from: event.target.value || undefined })}
            className="w-36"
          />
          <span className="text-ink-muted">–</span>
          <Input
            type="date"
            aria-label="To date"
            value={customTo}
            onChange={(event) => setParams({ to: event.target.value || undefined })}
            className="w-36"
          />
        </div>
      )}
      <div className="inline-flex rounded-md border border-line-strong p-0.5" role="group" aria-label={scopeLabel}>
        <Button
          type="button"
          variant={scope === "all" ? "default" : "ghost"}
          size="sm"
          aria-pressed={scope === "all"}
          onClick={() => setParams({ scope: undefined })}
        >
          All
        </Button>
        <Button
          type="button"
          variant={scope === "mine" ? "default" : "ghost"}
          size="sm"
          aria-pressed={scope === "mine"}
          onClick={() => setParams({ scope: "mine" })}
        >
          Mine
        </Button>
      </div>
    </div>
  );
}
