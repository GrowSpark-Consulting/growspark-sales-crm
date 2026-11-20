"use client";

import { useState } from "react";
import { cn } from "cn";
import {
  COUNTRY_CALLING_CODES,
  DEFAULT_COUNTRY_CALLING_CODE,
  matchCountryCallingCode,
  toE164,
} from "@growspark/shared";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function splitPhone(value: string): { countryCode: string; number: string } {
  if (!value) return { countryCode: DEFAULT_COUNTRY_CALLING_CODE, number: "" };
  const match = matchCountryCallingCode(value);
  if (!match) {
    // Unrecognised or legacy (pre-D41) value — best effort, not a crash:
    // show it as a plain number under the default country code so the user
    // can see and fix it, rather than silently losing it.
    return { countryCode: DEFAULT_COUNTRY_CALLING_CODE, number: value.replace(/\D/g, "") };
  }
  return { countryCode: match.code, number: value.slice(match.code.length) };
}

export interface PhoneInputProps {
  /** A canonical E.164 string (e.g. "+919840012345"), or "" when empty. */
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  "aria-label"?: string;
}

/**
 * D41: a country-code select (default +91) plus a plain number field,
 * composed into/out of a single canonical E.164 string — the exact shape
 * every Company/Contact/Lead `phone` field stores and validates against
 * (`phoneFieldSchema`, packages/shared). This component only composes the
 * two parts; the strict per-country shape check (exactly 10 digits starting
 * 6–9 for +91, 7–15 digits otherwise) happens in the shared Zod schema and
 * again server-side — it is never enforced here, so this never itself
 * blocks typing.
 */
export function PhoneInput({ value, onChange, onBlur, className, ...props }: PhoneInputProps) {
  const parsed = splitPhone(value ?? "");
  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [number, setNumber] = useState(parsed.number);

  // Adjusted during render when the external value changes for a reason
  // other than our own typing (e.g. the form is reset, or a different
  // record is loaded) — the same "adjust state during render" pattern
  // CompanySelect uses (D37), not an Effect. Crucially, `lastSeenValue` is
  // only ever updated here, from the prop — never from `emit` below — so a
  // same-render echo of our own `onChange` (which the parent has not yet
  // reflected back into `value`) is never mistaken for an external change
  // and does not stomp what was just typed.
  const [lastSeenValue, setLastSeenValue] = useState(value ?? "");
  if ((value ?? "") !== lastSeenValue) {
    setLastSeenValue(value ?? "");
    setCountryCode(parsed.countryCode);
    setNumber(parsed.number);
  }

  function emit(nextCountryCode: string, nextNumber: string) {
    const digits = nextNumber.replace(/\D/g, "");
    const next = digits ? toE164(nextCountryCode, digits) : "";
    onChange(next);
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Select
        value={countryCode}
        onValueChange={(next) => {
          setCountryCode(next);
          emit(next, number);
        }}
      >
        <SelectTrigger className="w-40 shrink-0" aria-label="Country code">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_CALLING_CODES.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        inputMode="numeric"
        placeholder="e.g. 98400 12345"
        aria-label={props["aria-label"] ?? "Phone number"}
        className="flex-1"
        value={number}
        onChange={(event) => {
          setNumber(event.target.value);
          emit(countryCode, event.target.value);
        }}
        onBlur={onBlur}
      />
    </div>
  );
}
