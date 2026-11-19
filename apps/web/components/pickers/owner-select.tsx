"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserOptions } from "@/hooks/use-user-options";

const UNASSIGNED = "UNASSIGNED";

export interface OwnerSelectProps {
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * Owner picker backed by GET /users/options — the same active-user list
 * every role can read (D33). An explicit "Unassigned" option maps to
 * `undefined`, not an empty string, so callers can tell "no owner chosen"
 * apart from "owner field not touched" the same way the rest of the forms
 * already do.
 */
export function OwnerSelect({ value, onValueChange, placeholder = "Owner", className, ...props }: OwnerSelectProps) {
  const { data, isLoading } = useUserOptions();
  const options = data?.data ?? [];

  return (
    <Select
      value={value ?? UNASSIGNED}
      onValueChange={(next) => onValueChange(next === UNASSIGNED ? undefined : next)}
    >
      <SelectTrigger className={className} aria-label={props["aria-label"] ?? placeholder}>
        <SelectValue placeholder={isLoading ? "Loading…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
