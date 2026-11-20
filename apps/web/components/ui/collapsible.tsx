"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "cn";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";

// Not yet in docs/design-system/ — no spec exists for a disclosure/accordion
// component there. Built from the same tokens and motion rules as every
// other component here (border-line, 120ms ease-out, no shadow) per the
// README's own "build it from these tokens, then send it back" closing note
// (§10). Used so far only by Company's "More details" section (D40).
function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(
        "label flex items-center gap-1.5 text-ink-muted transition-colors duration-[120ms] ease-out outline-none hover:text-ink [&[data-state=open]_svg]:rotate-90",
        className,
      )}
      {...props}
    >
      <ChevronRight className="size-4 shrink-0 transition-transform duration-[120ms] ease-out" aria-hidden="true" />
      {children}
    </CollapsiblePrimitive.Trigger>
  );
}

function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      className={cn("overflow-hidden", className)}
      {...props}
    />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
