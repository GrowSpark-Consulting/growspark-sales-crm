"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

type NumericInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value?: string | number;
  onValueChange: (value: string) => void;
  inputMode?: "decimal" | "numeric";
};

/** Text-backed numeric editing preserves empty values, leading zeroes and exact decimal text. */
export function NumericInput({ value, onValueChange, inputMode = "decimal", ...props }: NumericInputProps) {
  return <Input {...props} type="text" inputMode={inputMode} value={value ?? ""} onChange={(event) => onValueChange(event.target.value)} />;
}
