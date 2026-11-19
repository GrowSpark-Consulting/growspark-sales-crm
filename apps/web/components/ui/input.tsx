import * as React from "react"
import { cn } from "cn"

// Restyled per docs/design-system/components/Field/README.md: line-strong
// border, ink-muted on hover, primary on focus, danger + danger-soft fill
// when invalid. Height defaults to control-md (36px); the login page
// overrides to control-lg (44px) per the 1.6 task.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-(--control-md) w-full min-w-0 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink transition-colors duration-[120ms] ease-out outline-none selection:bg-primary-soft placeholder:text-ink-muted file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 hover:border-ink-muted focus:border-primary",
        "aria-invalid:border-danger aria-invalid:bg-danger-soft",
        className
      )}
      {...props}
    />
  )
}

export { Input }
