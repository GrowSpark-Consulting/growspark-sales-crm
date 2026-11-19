import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Restyled to match docs/design-system/components/Button/README.md exactly
// (gs-btn / gs-btn-primary / gs-btn-ghost / gs-btn-danger in bundle.css).
// shadcn's "outline" and "secondary" are both treated as the design
// system's one "Secondary (default)" style — there is no third bordered
// variant in the spec, and both names were already in use across the app
// for exactly that meaning (Edit, Reset password, pagination, Search).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors duration-[120ms] ease-out outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--icon-md)",
  {
    variants: {
      variant: {
        default: "bg-primary border border-primary text-primary-foreground hover:bg-primary-hover hover:border-primary-hover",
        secondary: "bg-surface border border-line-strong text-ink hover:bg-surface-hover",
        outline: "bg-surface border border-line-strong text-ink hover:bg-surface-hover",
        ghost: "border border-transparent bg-transparent text-ink hover:bg-surface-hover",
        destructive: "bg-surface border border-danger text-danger hover:bg-danger-soft",
        link: "border border-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-(--control-md) px-4",
        sm: "h-(--control-sm) px-3 text-[13px]",
        lg: "h-(--control-lg) px-6",
        icon: "size-(--control-md)",
        "icon-sm": "size-(--control-sm)",
        "icon-lg": "size-(--control-lg)",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
