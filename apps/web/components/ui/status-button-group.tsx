"use client";

import { useState, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface StatusOption<T extends string = string> {
  value: T;
  /** The button text. */
  label: string;
  /** Used in the success toast, "Status changed to <statusLabel>"; defaults to `label`. */
  statusLabel?: string;
  /** Style of this option while it is not the selected one. */
  variant?: "default" | "outline" | "ghost" | "destructive";
  /** If set, clicking opens a confirmation dialog first; the call is only made from its confirm button. */
  confirm?: { title: string; description: string; confirmLabel: string; destructive?: boolean };
}

/**
 * Every status-change button group in the app (D105): visible hover, active
 * and keyboard-focus styles, a pointer cursor, and — while the change is
 * being saved — a spinner on the clicked button with every button in the
 * group disabled, so a double click can never send two changes. On success
 * the option becomes the selected one and a "Status changed to <Status>"
 * toast appears; on failure an error toast (or, inside a confirmation
 * dialog, the dialog's error banner) says what went wrong.
 *
 * The component only wraps WHAT THE CALLER ALREADY CALLED: `onSelect` is the
 * caller's own API call, unchanged. It decides nothing about which statuses
 * are allowed — callers still pass only the options their rules permit.
 */
export function StatusButtonGroup<T extends string>({
  groupLabel,
  options,
  current,
  onSelect,
  successMessage,
  errorMessage = "Could not change status. Please try again.",
  trailing,
  className,
}: {
  /** Accessible name of the group, e.g. "Change status". */
  groupLabel: string;
  options: readonly StatusOption<T>[];
  /** The option that is the record's current status, shown as selected. Omit for pure actions. */
  current?: T | undefined;
  onSelect: (value: T) => Promise<unknown>;
  /** Overrides the default toast text for a successful change. */
  successMessage?: (option: StatusOption<T>) => string;
  errorMessage?: string;
  /** Extra controls that belong to the same group (e.g. a dialog with its own form); `busy` mirrors the group. */
  trailing?: (state: { busy: boolean }) => ReactNode;
  className?: string;
}) {
  const [pendingValue, setPendingValue] = useState<T | null>(null);
  // After a successful change the new option shows as selected straight away;
  // it is tied to the `current` it was made from, so as soon as the refetched
  // record brings a different `current`, the server's answer takes over.
  const [confirmed, setConfirmed] = useState<{ value: T; from: T | undefined } | null>(null);
  const [confirming, setConfirming] = useState<StatusOption<T> | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const busy = pendingValue !== null;
  const confirmedValue = confirmed !== null && confirmed.from === current ? confirmed.value : null;
  const selected = confirmedValue ?? current;

  async function run(option: StatusOption<T>, inDialog: boolean) {
    if (busy) return;
    setPendingValue(option.value);
    setDialogError(null);
    try {
      await onSelect(option.value);
      setConfirmed({ value: option.value, from: current });
      setConfirming(null);
      toast.success(successMessage ? successMessage(option) : `Status changed to ${option.statusLabel ?? option.label}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : errorMessage;
      if (inDialog) setDialogError(message);
      else toast.error(message);
    } finally {
      setPendingValue(null);
    }
  }

  function handleClick(option: StatusOption<T>) {
    if (busy || option.value === selected) return;
    if (option.confirm) {
      setDialogError(null);
      setConfirming(option);
    } else {
      void run(option, false);
    }
  }

  return (
    <>
      <div role="group" aria-label={groupLabel} aria-busy={busy} className={cn("flex flex-wrap items-center gap-2", className)}>
        {options.map((option) => {
          const isSelected = option.value === selected;
          const isPending = pendingValue === option.value && !option.confirm;
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={isSelected ? "default" : (option.variant ?? "outline")}
              aria-pressed={current !== undefined || confirmedValue !== null ? isSelected : undefined}
              disabled={busy}
              onClick={() => handleClick(option)}
              className={cn(
                "cursor-pointer transition-colors duration-[120ms] active:scale-[0.98]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--focus-ring)",
                !isSelected && "hover:bg-surface-hover active:bg-surface-sunken",
                isSelected && "cursor-default",
              )}
            >
              {isPending ? (
                <Loader2 className="size-(--icon-md) animate-spin" aria-hidden="true" data-testid="status-spinner" />
              ) : isSelected ? (
                <Check className="size-(--icon-md)" aria-hidden="true" />
              ) : null}
              {option.label}
            </Button>
          );
        })}
        {trailing?.({ busy })}
      </div>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirming?.confirm?.title}</DialogTitle>
            <DialogDescription>{confirming?.confirm?.description}</DialogDescription>
          </DialogHeader>
          {dialogError && (
            <Alert variant="destructive">
              <AlertDescription>{dialogError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant={confirming?.confirm?.destructive ? "destructive" : "default"}
              disabled={busy}
              className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--focus-ring)"
              onClick={() => confirming && void run(confirming, true)}
            >
              {busy && <Loader2 className="size-(--icon-md) animate-spin" aria-hidden="true" data-testid="status-spinner" />}
              {busy ? "Working…" : confirming?.confirm?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
