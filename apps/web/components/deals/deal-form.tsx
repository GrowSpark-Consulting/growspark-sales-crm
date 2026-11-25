"use client";

import { useLayoutEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createDealSchema, type CreateDealInput, type DealResponse } from "@growspark/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OwnerSelect } from "@/components/pickers/owner-select";
import { CompanySelect } from "@/components/pickers/company-select";
import { useCompany } from "@/hooks/use-companies";
import { usePipelineStages } from "@/hooks/use-pipeline";
import { useLeadSources, selectableLeadSources } from "@/hooks/use-lead-sources";
import { stripEmptyOptionalFields } from "@/lib/form-utils";
import { handleApiFormError } from "@/lib/handle-form-error";

const NO_SOURCE = "NO_SOURCE";

/**
 * createDealSchema's `value`/`probability` are z.coerce.number() — correct
 * for the API, but Zod v4's coercing input type is `unknown` (same gotcha as
 * Company's annualRevenue, D38), which breaks a plain useForm<CreateDealInput>.
 * Overridden here with non-coercing validators, same fix as D38.
 */
const dealFormSchema = createDealSchema.extend({
  value: z.union([z.number().nonnegative("Value cannot be negative"), z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")]).optional(),
  probability: z.union([z.number().int().min(0).max(100), z.string().regex(/^(100|[0-9]{1,2})$/, "Probability must be a whole number")]).optional(),
});
type DealFormInput = z.infer<typeof dealFormSchema>;

/** Exported so a test can assert the reset target is genuinely blank (same D42 convention as Lead/Company). */
export function dealToFormValues(deal?: DealResponse, defaultOwnerId?: string, defaultCompanyId?: string): DealFormInput {
  return {
    name: deal?.name ?? "",
    companyId: deal?.companyId ?? defaultCompanyId ?? "",
    stageId: undefined,
    value: deal?.value ?? undefined,
    probability: deal?.probability,
    expectedCloseDate: deal?.expectedCloseDate ?? undefined,
    ownerId: deal?.ownerId ?? defaultOwnerId ?? undefined,
    dealType: deal?.dealType ?? "",
    sourceId: deal?.sourceId ?? undefined,
  };
}

export interface DealFormProps {
  /** Present in edit mode; omitted when creating. */
  deal?: DealResponse;
  /** Create mode only: the signed-in user, so Owner defaults to "me" rather than Unassigned. */
  defaultOwnerId?: string;
  /** Create mode only: pre-fills Company — e.g. "Add deal" from a Company's own Deals tab (3.5). Still editable. */
  defaultCompanyId?: string;
  onSubmit: (values: CreateDealInput) => Promise<unknown>;
  submitLabel: string;
  pendingLabel: string;
  onCancel: () => void;
}

/**
 * Shared create/edit form, same "validate against the create schema even
 * when editing" convention as Company/Contact (D38) — updateDealSchema has
 * no `stageId` key at all (stage changes only ever go through POST
 * /deals/:id/stage, D47), so the Stage field below is create-only; sending
 * it anyway on an edit submit is harmless, the server silently strips an
 * unknown key exactly like Lead's read-only fields (D35).
 */
export function DealForm({
  deal,
  defaultOwnerId,
  defaultCompanyId,
  onSubmit,
  submitLabel,
  pendingLabel,
  onCancel,
}: DealFormProps) {
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(deal);

  const form = useForm<DealFormInput>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: dealToFormValues(deal, defaultOwnerId, defaultCompanyId),
  });

  const companyId = form.watch("companyId");
  const existingCompanyQuery = useCompany(companyId || undefined);
  const { data: stagesData } = usePipelineStages();
  const openStages = (stagesData?.data ?? []).filter((stage) => stage.type === "OPEN");
  const { data: sourcesData } = useLeadSources({ includeInactive: true });

  // Create-only: default Stage (and therefore Probability) to the
  // pipeline's first open stage once stages have loaded — the same
  // "preselect a sensible default, never override an explicit pick"
  // pattern as Lead's Source (D40/D45), not a hard-coded assumption about
  // position 0 always being the right stage once the user has touched it.
  useLayoutEffect(() => {
    if (isEdit || openStages.length === 0) return;
    if (form.getValues("stageId")) return;
    const firstStage = openStages[0]!;
    form.setValue("stageId", firstStage.id);
    form.setValue("probability", firstStage.probability);
    // openStages is derived from query data each render; only its identity
    // via length/first-id meaningfully changes what this effect should do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, openStages.length, openStages[0]?.id, form]);

  // D42: with cacheComponents enabled, a navigated-away-from static route is
  // hidden with React's Activity, not unmounted, so form state would survive
  // a revisit unless reset — effect cleanup still fires on hide, exactly
  // like a real unmount. Same pattern as LeadForm/CompanyForm.
  useLayoutEffect(() => {
    if (isEdit) return;
    return () => {
      form.reset(dealToFormValues(undefined, defaultOwnerId, defaultCompanyId));
      setBannerError(null);
    };
  }, [isEdit, defaultOwnerId, defaultCompanyId, form]);

  async function handleSubmit(values: DealFormInput) {
    setBannerError(null);
    setSubmitting(true);
    try {
      await onSubmit(stripEmptyOptionalFields(values) as CreateDealInput);
    } catch (error) {
      setBannerError(handleApiFormError(error, form));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6" noValidate>
        {bannerError && (
          <Alert variant="destructive">
            <AlertDescription>{bannerError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Deal name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company *</FormLabel>
                <FormControl>
                  <CompanySelect
                    value={field.value ? { id: field.value, name: existingCompanyQuery.data?.data.name ?? "" } : undefined}
                    onValueChange={(company) => field.onChange(company?.id ?? "")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {!isEdit && (
            <FormField
              control={form.control}
              name="stageId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        const stage = openStages.find((candidate) => candidate.id === value);
                        if (stage) form.setValue("probability", stage.probability);
                      }}
                    >
                      <SelectTrigger className="w-full" aria-label="Stage">
                        <SelectValue placeholder="First open stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {openStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="value"
            render={({ field: { value, onChange, ...field } }) => (
              <FormItem>
                <FormLabel>Value (₹)</FormLabel>
                <FormControl>
                  <NumericInput
                    value={value ?? ""}
                    onValueChange={(next) => onChange(next === "" ? undefined : next)}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="probability"
            render={({ field: { value, onChange, ...field } }) => (
              <FormItem>
                <FormLabel>Probability (%)</FormLabel>
                <FormControl>
                  <NumericInput
                    inputMode="numeric"
                    value={value ?? ""}
                    onValueChange={(next) => onChange(next === "" ? undefined : next)}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expectedCloseDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expected close date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ownerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Owner</FormLabel>
                <FormControl>
                  <OwnerSelect value={field.value ?? undefined} onValueChange={field.onChange} className="w-full" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dealType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deal type</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. New business" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sourceId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source</FormLabel>
                <FormControl>
                  <Select
                    value={field.value ?? NO_SOURCE}
                    onValueChange={(value) => field.onChange(value === NO_SOURCE ? undefined : value)}
                  >
                    <SelectTrigger className="w-full" aria-label="Source">
                      <SelectValue placeholder="No source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SOURCE}>No source</SelectItem>
                      {selectableLeadSources(sourcesData?.data ?? [], deal?.sourceId).map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-2">
            <label className="label text-ink-muted">Currency</label>
            <Input value="INR" disabled />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? pendingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
