import { useEffect, useState } from "react";

/** Returns `value`, delayed by `delayMs` of no further changes — e.g. debouncing a search input before it drives a query. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
