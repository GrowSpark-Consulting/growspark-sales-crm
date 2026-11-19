import * as React from "react";
import { cn } from "cn";

// Same Field treatment as Input (docs/design-system/components/Field/README.md:
// "Selects, date pickers, textareas and search use the same height, border,
// radius and states") — border-line-strong, danger on invalid, focus ring.
// No shadcn-generated textarea exists in this repo yet; this is the minimal
// multi-line equivalent of input.tsx, not a new pattern.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink transition-colors duration-[120ms] ease-out outline-none selection:bg-primary-soft placeholder:text-ink-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 hover:border-ink-muted focus:border-primary",
        "aria-invalid:border-danger aria-invalid:bg-danger-soft",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
