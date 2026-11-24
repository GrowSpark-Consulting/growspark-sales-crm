"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import type { ApiKeyResponse, ApiKeyCreatedResponse } from "@growspark/shared";
import { apiPost, ApiError } from "@/lib/api-client";
import { API_KEYS_QUERY_KEY_ROOT } from "@/hooks/use-api-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Rotate = revoke the old key and create a new one in a single confirmation
 * (apps/api does this in one transaction) — the new raw key then needs the
 * same "shown once, with a copy button" treatment create does, so this
 * can't reuse the plain ConfirmActionDialog.
 */
export function RotateApiKeyDialog({ apiKey }: { apiKey: ApiKeyResponse }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  function reset() {
    setPending(false);
    setBannerError(null);
    setNewKey(null);
    setCopied(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // The list is only refreshed once this dialog actually closes, never
      // the instant rotation succeeds. ApiKeysPageClient only renders a
      // RotateApiKeyDialog for a row whose apiKey.revokedAt is falsy — an
      // immediate refetch would show the just-rotated-out old key as
      // revoked and unmount this very component (and the open dialog along
      // with it) before the reveal view below was ever shown. See D75.
      if (newKey) {
        void queryClient.invalidateQueries({ queryKey: [API_KEYS_QUERY_KEY_ROOT] });
      }
      reset();
    }
  }

  async function handleRotate() {
    setPending(true);
    setBannerError(null);
    try {
      const result = await apiPost<ApiKeyCreatedResponse>(`/api/v1/api-keys/${apiKey.id}/rotate`);
      setNewKey(result.data.key);
    } catch (error) {
      setBannerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleCopy() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy automatically — select the key and copy it manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Rotate
        </Button>
      </DialogTrigger>
      <DialogContent>
        {newKey ? (
          <>
            <DialogHeader>
              <DialogTitle>API key rotated</DialogTitle>
              <DialogDescription>
                The old key ({apiKey.keyPrefix}…) stopped working immediately. Copy the new key now — you will not
                see it again.
              </DialogDescription>
            </DialogHeader>
            <Alert variant="warning">
              <AlertDescription>This is the only time the full key is shown.</AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={newKey}
                className="font-mono text-sm"
                onFocus={(event) => event.currentTarget.select()}
                aria-label="New API key"
              />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label="Copy API key">
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Rotate API key</DialogTitle>
              <DialogDescription>
                {apiKey.name} ({apiKey.keyPrefix}…) will stop working immediately, replaced by a new key with the
                same name. Any integration using the old key must be updated.
              </DialogDescription>
            </DialogHeader>
            {bannerError && (
              <Alert variant="destructive">
                <AlertDescription>{bannerError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button disabled={pending} onClick={handleRotate}>
                {pending ? "Rotating…" : "Rotate key"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
