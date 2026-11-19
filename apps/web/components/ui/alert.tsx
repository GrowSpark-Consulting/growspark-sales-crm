import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Restyled per docs/design-system/components/Alert/README.md and
// bundle.css .gs-alert: soft tone background, icon in the strong tone
// colour, ink body text. "destructive" is kept as the variant name (every
// call site already uses it) but now maps to the danger tone, not a red fill.
const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-md px-4 py-3 text-sm text-ink has-[>svg]:grid-cols-[calc(var(--icon-md)+var(--spacing)*3)_1fr] has-[>svg]:gap-x-3 [&>svg]:mt-0.5 [&>svg]:size-(--icon-md) [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-info-soft [&>svg]:text-info",
        success: "bg-success-soft [&>svg]:text-success",
        warning: "bg-warning-soft [&>svg]:text-warning",
        destructive: "bg-danger-soft [&>svg]:text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-ink [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
