"use client";

import { useState } from "react";
import { LOSS_REASONS, type LossReason } from "@growspark/shared";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Close as Lost needs a reason (D15's LOSS_REASONS, closed list) before it
 * can submit — unlike Close as Won, which is a plain confirm
 * (ConfirmActionDialog already covers that case).
 */
export function CloseLostDialog({
  onConfirm,
  disabled = false,
}: {
  onConfirm: (reason: LossReason, note?: string) => Promise<unknown>;
  /** True while a sibling status button in the same group is saving (D105). */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<LossReason | undefined>(undefined);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setReason(undefined);
      setNote("");
      setError(null);
    }
  }

  async function handleConfirm() {
    if (!reason) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm(reason, note.trim() || undefined);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not close this deal. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="cursor-pointer transition-colors hover:bg-surface-hover active:bg-surface-sunken active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--focus-ring)"
        >
          Close as Lost
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close deal as Lost</DialogTitle>
          <DialogDescription>A reason is required.</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="grid gap-2">
            <label className="label text-ink-muted" htmlFor="lost-reason">
              Reason *
            </label>
            <Select value={reason} onValueChange={(value) => setReason(value as LossReason)}>
              <SelectTrigger id="lost-reason" className="w-full" aria-label="Lost reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {LOSS_REASONS.map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {candidate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="label text-ink-muted" htmlFor="lost-note">
              Note
            </label>
            <Textarea id="lost-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!reason || pending}
            onClick={handleConfirm}
            className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--focus-ring)"
          >
            {pending && <Loader2 className="size-(--icon-md) animate-spin" aria-hidden="true" data-testid="status-spinner" />}
            {pending ? "Closing…" : "Close as Lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
