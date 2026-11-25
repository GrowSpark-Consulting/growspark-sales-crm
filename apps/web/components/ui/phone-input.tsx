"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "cn";
import {
  COUNTRY_CALLING_CODES,
  DEFAULT_COUNTRY_CALLING_CODE,
  cleanTypedPhoneDigits,
  matchCountryCallingCode,
  parsePhoneInput,
  phoneDigitLimits,
  toE164,
} from "@growspark/shared";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Exported for tests. A stored value → the country select and the digits box. */
export function splitPhone(value: string): { countryCode: string; number: string; cleanedUp?: boolean } {
  if (!value) return { countryCode: DEFAULT_COUNTRY_CALLING_CODE, number: "" };
  const match = value.startsWith("+") ? matchCountryCallingCode(value) : undefined;
  if (match && /^\d*$/.test(value.slice(match.code.length))) {
    return { countryCode: match.code, number: value.slice(match.code.length) };
  }
  // Older free text (e.g. "+91 44 4000 1234" or "044 4000 1234"): read it the
  // way a paste is read; failing that, show its digits under India so the
  // user can see and fix it rather than lose it.
  const parsed = parsePhoneInput(value);
  if (parsed.ok) return { countryCode: parsed.countryCode, number: parsed.nationalDigits, cleanedUp: true };
  return { countryCode: DEFAULT_COUNTRY_CALLING_CODE, number: value.replace(/\D/g, "") };
}

export interface PhoneInputProps {
  /** A canonical E.164 string (e.g. "+919840012345"), or "" when empty. */
  value: string | null | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}

/**
 * D41 → D99: the one phone input used everywhere a phone number is typed
 * (leads, contacts, companies, organisation settings). A country-code select
 * (India first and default) plus a digits-only box, composed into one E.164
 * string.
 *
 * - Typing: only digits are accepted (letters and symbols are ignored); a
 *   leading 0 is dropped; once the country's limit is reached (India: 10) a
 *   further digit is refused — the box simply doesn't change.
 * - Pasting: "+91 98400-12345", "098400 12345", "919840012345" and
 *   "+44 20 7946 0958" are cleaned up into the right country and digits (the
 *   rules live in packages/shared `parsePhoneInput`). A paste that is still
 *   too long, or has an unknown country code, is refused with a message —
 *   never silently cut short.
 * - No digit counter (removed at the user's request after D99). "Too
 *   short"/"invalid" messages come from the shared Zod rule
 *   (`phoneFieldSchema`), the same one the server applies.
 */
export function PhoneInput({ value, onChange, onBlur, className, id, ...aria }: PhoneInputProps) {
  const messageId = useId();
  const initial = splitPhone(value ?? "");
  const [countryCode, setCountryCode] = useState(initial.countryCode);
  const [number, setNumber] = useState(initial.number);
  const [message, setMessage] = useState<string | null>(null);

  // Adjusted during render, not an Effect (D37). `emitted` is the last value
  // this input sent up: when the parent echoes it back, that is not an
  // outside change, so nothing is reset (clearing the digits under +44 must
  // not snap the country back to +91). Anything else — a form reset, another
  // record loaded — re-reads the value.
  const [lastSeenValue, setLastSeenValue] = useState(value ?? "");
  const [emitted, setEmitted] = useState<string | null>(null);
  if ((value ?? "") !== lastSeenValue) {
    setLastSeenValue(value ?? "");
    if ((value ?? "") !== emitted) {
      const next = splitPhone(value ?? "");
      setCountryCode(next.countryCode);
      setNumber(next.number);
      setMessage(null);
    }
  }

  // An older stored value that had to be cleaned up to display (e.g. digits
  // saved without "+" by website intake) is sent up once, cleaned, so what the
  // box shows is what the form saves. Runs on mount only.
  useEffect(() => {
    if (initial.cleanedUp && initial.number) emit(initial.countryCode, initial.number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { max } = phoneDigitLimits(countryCode);
  const country = COUNTRY_CALLING_CODES.find((candidate) => candidate.code === countryCode);

  function emit(nextCountryCode: string, nextNumber: string) {
    const next = nextNumber ? toE164(nextCountryCode, nextNumber) : "";
    setEmitted(next);
    onChange(next);
  }

  function handleType(raw: string) {
    const digits = cleanTypedPhoneDigits(raw);
    if (digits.length > max) {
      // The limit is reached: refuse the extra digit (the box keeps its value).
      setMessage(`${country?.label ?? countryCode} numbers have at most ${max} digits.`);
      return;
    }
    setMessage(null);
    if (digits === number) return;
    setNumber(digits);
    emit(countryCode, digits);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    event.preventDefault();
    const input = event.currentTarget;
    const start = input.selectionStart ?? number.length;
    const end = input.selectionEnd ?? number.length;
    // A number with its own country code replaces the whole field; anything
    // else is pasted where the cursor is, then the result is read as a whole.
    const international = /^\s*(\+|00[1-9])/.test(text);
    const parsed = parsePhoneInput(international ? text : number.slice(0, start) + text + number.slice(end), countryCode);
    if (!parsed.ok) {
      setMessage(`${parsed.message}. Nothing was pasted.`);
      return;
    }
    setMessage(null);
    setCountryCode(parsed.countryCode);
    setNumber(parsed.nationalDigits);
    emit(parsed.countryCode, parsed.nationalDigits);
  }

  const describedBy = [aria["aria-describedby"], message ? messageId : undefined].filter(Boolean).join(" ");

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex gap-2">
        <Select
          value={countryCode}
          onValueChange={(next) => {
            setCountryCode(next);
            setMessage(null);
            emit(next, number);
          }}
        >
          <SelectTrigger className="w-44 shrink-0" aria-label="Country code">
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
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={countryCode === DEFAULT_COUNTRY_CALLING_CODE ? "e.g. 9840012345" : "Digits only"}
          aria-label={aria["aria-label"] ?? "Phone number"}
          aria-invalid={aria["aria-invalid"]}
          aria-describedby={describedBy || undefined}
          className="flex-1"
          value={number}
          onChange={(event) => handleType(event.target.value)}
          onPaste={handlePaste}
          onBlur={onBlur}
        />
      </div>
      {message && (
        <p id={messageId} role="status" className="text-xs text-ink-muted">
          {message}
        </p>
      )}
    </div>
  );
}
