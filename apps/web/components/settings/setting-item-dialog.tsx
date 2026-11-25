"use client";

import { useState } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { handleApiFormError } from "@/lib/handle-form-error";

interface Values {
  name: string;
  probability?: number;
}

/**
 * One small form dialog for every settings list item: add or rename a lead
 * source, add or edit a pipeline stage. `schema` is the shared Zod schema
 * for that exact request, so the screen and the API validate identically.
 * `probability: "hidden"` leaves the field out; `"readonly"` shows it but
 * locks it (Won/Lost stages).
 */
export function SettingItemDialog({
  triggerLabel,
  triggerVariant = "outline",
  triggerSize = "sm",
  title,
  description,
  submitLabel,
  schema,
  initialValues,
  probability = "hidden",
  onSubmit,
}: {
  triggerLabel: string;
  triggerVariant?: "default" | "outline" | "ghost";
  triggerSize?: "default" | "sm";
  title: string;
  description?: string;
  submitLabel: string;
  schema: z.ZodType<Values, FieldValues>;
  initialValues: Values;
  probability?: "hidden" | "editable" | "readonly";
  onSubmit: (values: Values) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<Values>({
    // The probability validator coerces, so the schema's input type is `unknown`;
    // the form itself only ever holds a number (see the Input below).
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: initialValues,
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setBannerError(null);
      form.reset(initialValues);
    }
  }

  async function submit(values: Values) {
    setBannerError(null);
    setSubmitting(true);
    try {
      const body: Values = { name: values.name };
      if (probability === "editable") body.probability = values.probability;
      await onSubmit(body);
      setOpen(false);
    } catch (error) {
      setBannerError(handleApiFormError(error, form));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {bannerError && (
          <Alert variant="destructive">
            <AlertDescription>{bannerError}</AlertDescription>
          </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {probability !== "hidden" && (
              <FormField
                control={form.control}
                name="probability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Probability (%){probability === "editable" ? " *" : ""}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        step={1}
                        readOnly={probability === "readonly"}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(event.target.value === "" ? undefined : event.target.valueAsNumber)
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    {probability === "readonly" && (
                      <p className="text-sm text-ink-muted">Won is always 100% and Lost always 0%.</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
