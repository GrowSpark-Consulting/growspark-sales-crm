"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { createApiKeySchema, type CreateApiKeyInput, type ApiKeyCreatedResponse } from "@growspark/shared";
import { apiPost } from "@/lib/api-client";
import { handleApiFormError } from "@/lib/handle-form-error";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Two steps in one dialog: the create form, then — on success, without
 * closing — the raw key, shown exactly once with a copy button and a clear
 * warning. Closing this dialog is the only way to dismiss the key; there is
 * no way to see it again afterwards (the server never returns it a second
 * time, only keyPrefix).
 */
export function CreateApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<CreateApiKeyInput>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: { name: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateApiKeyInput) => apiPost<ApiKeyCreatedResponse>("/api/v1/api-keys", values),
    onSuccess: (result) => {
      setCreatedKey(result.data.key);
    },
    onError: (error) => {
      setBannerError(handleApiFormError(error, form));
    },
  });

  function reset() {
    setBannerError(null);
    setCreatedKey(null);
    setCopied(false);
    form.reset({ name: "" });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Deferred until the dialog actually closes, not the instant creation
      // succeeds — this component itself is never conditionally unmounted
      // by the list refetching (unlike RotateApiKeyDialog, D75), but the
      // same deferred-invalidate pattern is kept here too so the two
      // reveal-once dialogs behave identically and neither can regress into
      // the same class of bug if this component's rendering context ever
      // changes.
      if (createdKey) {
        void queryClient.invalidateQueries({ queryKey: [API_KEYS_QUERY_KEY_ROOT] });
      }
      reset();
    }
  }

  async function handleCopy() {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy automatically — select the key and copy it manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>New API key</Button>
      </DialogTrigger>
      <DialogContent>
        {createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>API key created</DialogTitle>
              <DialogDescription>
                Copy this key now. You will not see it again — only its prefix will be shown from here on.
              </DialogDescription>
            </DialogHeader>
            <Alert variant="warning">
              <AlertDescription>This is the only time the full key is shown.</AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={createdKey}
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
              <DialogTitle>New API key</DialogTitle>
              <DialogDescription>Used by the website intake integration to authenticate its requests.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => {
                  setBannerError(null);
                  mutation.mutate(values);
                })}
                className="space-y-4"
              >
                {bannerError && (
                  <Alert variant="destructive">
                    <AlertDescription>{bannerError}</AlertDescription>
                  </Alert>
                )}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Website intake" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Creating…" : "Create key"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
