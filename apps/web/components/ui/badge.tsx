import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Restyled per docs/design-system/components/Badge/README.md and
// bundle.css .gs-badge: a leading 6px dot (currentColor) plus the word —
// colour never carries meaning alone. "accent" exists only because the
// README lists it as a tone (new/highlight), not because buttons may use it.
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 overflow-hidden rounded-sm px-2 text-xs leading-4 font-medium whitespace-nowrap h-[22px] bg-surface-sunken text-ink-muted before:content-[''] before:size-1.5 before:shrink-0 before:rounded-full before:bg-current [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-surface-sunken text-ink-muted",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        accent: "bg-brand-accent-soft text-brand-accent-soft-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
