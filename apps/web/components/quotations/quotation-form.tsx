"use client";

import { useLayoutEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_QUOTATION_TAX_PERCENT,
  MAX_QUOTATION_LINE_ITEMS,
  calculateQuotationSchema,
  quotationCreatableFields,
  quotationLineItemInputSchema,
  type CalculateQuotationInput,
  type CreateQuotationInput,
  type QuotationResponse,
} from "@growspark/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OwnerSelect } from "@/components/pickers/owner-select";
import { CompanySelect } from "@/components/pickers/company-select";
import { ContactSelect } from "@/components/pickers/contact-select";
import { QuotationTotalsSummary } from "@/components/quotations/quotation-totals";
import { useCompany } from "@/hooks/use-companies";
import { useContact } from "@/hooks/use-contacts";
import { useDeal, useDealsList } from "@/hooks/use-deals";
import { useQuotationTotals } from "@/hooks/use-quotations";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { handleApiFormError } from "@/lib/handle-form-error";

const NO_DEAL = "NO_DEAL";

/** A blank text box means "not given", not "" — the shared validators only ever see real values (same reason as stripEmptyOptionalFields). */
function blankToUndefined<T extends z.ZodType>(schema: T) {
  return z.union([z.literal("").transform(() => undefined), schema]).optional();
}

/**
 * Built from the shared field validators (no re-declared rules): only the
 * optional text boxes are wrapped so an empty box means "not given".
 * Money/quantity/percent values stay strings end to end — the server does
 * all the arithmetic.
 */
const quotationFormSchema = z.object({
  ...quotationCreatableFields,
  issueDate: blankToUndefined(z.iso.date()),
  validUntil: blankToUndefined(z.iso.date()),
  discountPercent: blankToUndefined(quotationCreatableFields.discountPercent.unwrap()),
  taxPercent: blankToUndefined(quotationCreatableFields.taxPercent.unwrap()),
  lineItems: z
    .array(
      quotationLineItemInputSchema.extend({
        discountPercent: blankToUndefined(quotationLineItemInputSchema.shape.discountPercent.unwrap()),
      }),
    )
    .min(1, "Add at least one line item")
    .max(MAX_QUOTATION_LINE_ITEMS),
});

interface QuotationFormValues {
  companyId: string;
  contactId: string;
  dealId: string | null;
  ownerId: string | null | undefined;
  issueDate: string;
  validUntil: string;
  discountPercent: string;
  taxPercent: string;
  terms: string;
  notes: string;
  lineItems: { description: string; quantity: string; unitPrice: string; discountPercent: string }[];
}

const BLANK_LINE = { description: "", quantity: "1", unitPrice: "", discountPercent: "" };

/** Exported so a test can assert the D42 reset target is genuinely blank. */
export function quotationToFormValues(
  quotation?: QuotationResponse,
  defaults: { ownerId?: string; companyId?: string; dealId?: string } = {},
): QuotationFormValues {
  const trimZero = (value: string) => (value === "0.00" ? "" : value);
  return {
    companyId: quotation?.companyId ?? defaults.companyId ?? "",
    contactId: quotation?.contactId ?? "",
    dealId: quotation ? quotation.dealId : (defaults.dealId ?? null),
    ownerId: quotation ? quotation.ownerId : defaults.ownerId,
    issueDate: quotation?.issueDate ?? "",
    validUntil: quotation?.validUntil ?? "",
    discountPercent: quotation ? trimZero(quotation.discountPercent) : "",
    taxPercent: quotation?.taxPercent ?? DEFAULT_QUOTATION_TAX_PERCENT,
    terms: quotation?.terms ?? "",
    notes: quotation?.notes ?? "",
    lineItems: quotation?.lineItems?.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: trimZero(item.discountPercent),
    })) ?? [{ ...BLANK_LINE }],
  };
}

/** The live-totals request, or null while the lines aren't valid yet (validated with the shared schema, not re-implemented). */
export function toCalculateInput(values: Pick<QuotationFormValues, "lineItems" | "discountPercent" | "taxPercent">): CalculateQuotationInput | null {
  const parsed = calculateQuotationSchema.safeParse({
    discountPercent: values.discountPercent || undefined,
    taxPercent: values.taxPercent || undefined,
    lineItems: values.lineItems.map((line) => ({ ...line, discountPercent: line.discountPercent || undefined })),
  });
  return parsed.success ? parsed.data : null;
}

export interface QuotationFormProps {
  quotation?: QuotationResponse;
  defaultOwnerId?: string;
  defaultCompanyId?: string;
  defaultDealId?: string;
  onSubmit: (values: CreateQuotationInput) => Promise<unknown>;
  submitLabel: string;
  pendingLabel: string;
  onCancel: () => void;
}

export function QuotationForm({
  quotation,
  defaultOwnerId,
  defaultCompanyId,
  defaultDealId,
  onSubmit,
  submitLabel,
  pendingLabel,
  onCancel,
}: QuotationFormProps) {
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(quotation);
  const defaults = { ownerId: defaultOwnerId, companyId: defaultCompanyId, dealId: defaultDealId };

  const form = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationFormSchema) as never,
    defaultValues: quotationToFormValues(quotation, defaults),
  });
  const lines = useFieldArray({ control: form.control, name: "lineItems" });

  const [companyId, contactId, watchedLines, discountPercent, taxPercent] = useWatch({
    control: form.control,
    name: ["companyId", "contactId", "lineItems", "discountPercent", "taxPercent"],
  });
  const companyQuery = useCompany(companyId || undefined);
  const contactQuery = useContact(contactId || undefined);
  const dealsQuery = useDealsList({ companyId: companyId || undefined, pageSize: 100, sort: "createdAt:desc" });
  const prefillDealQuery = useDeal(isEdit ? undefined : defaultDealId);

  // Prefill the contact from the deal's primary contact when starting from
  // a deal — only while the contact box is still empty, never overwriting a
  // pick the user already made (D50's lesson about async defaults).
  const primaryContactId = prefillDealQuery.data?.data.contacts.find((contact) => contact.isPrimary)?.contactId;
  useLayoutEffect(() => {
    if (primaryContactId && !form.getValues("contactId")) {
      form.setValue("contactId", primaryContactId);
    }
  }, [primaryContactId, form]);

  // D42: create-mode forms reset to blank when Cache Components hides the page.
  useLayoutEffect(() => {
    if (isEdit) return;
    return () => {
      form.reset(quotationToFormValues(undefined, { ownerId: defaultOwnerId, companyId: defaultCompanyId, dealId: defaultDealId }));
      setBannerError(null);
    };
  }, [isEdit, defaultOwnerId, defaultCompanyId, defaultDealId, form]);

  const calculateInput = toCalculateInput({ lineItems: watchedLines ?? [], discountPercent: discountPercent ?? "", taxPercent: taxPercent ?? "" });
  const debouncedInput = useDebouncedValue(calculateInput ? JSON.stringify(calculateInput) : null, 300);
  const totalsQuery = useQuotationTotals(debouncedInput ? (JSON.parse(debouncedInput) as CalculateQuotationInput) : null);
  const lineTotals = calculateInput ? totalsQuery.data?.data.lineTotals : undefined;

  // zodResolver hands handleSubmit the schema's *output* (blank boxes already
  // turned into "not given"), typed here as the raw form values because this
  // repo's Form/FormField wrappers take the single-type useForm.
  async function handleSubmit(formValues: QuotationFormValues) {
    const values = formValues as unknown as CreateQuotationInput;
    setBannerError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      setBannerError(handleApiFormError(error, form));
    } finally {
      setSubmitting(false);
    }
  }

  const deals = (dealsQuery.data?.data ?? []).filter((deal) => deal.companyId === companyId);

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
            name="companyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company *</FormLabel>
                <FormControl>
                  <CompanySelect
                    aria-label="Company"
                    value={field.value ? { id: field.value, name: companyQuery.data?.data.name ?? quotation?.companyName ?? "" } : undefined}
                    onValueChange={(company) => {
                      const next = company?.id ?? "";
                      if (next !== field.value) {
                        form.setValue("contactId", "");
                        form.setValue("dealId", null);
                      }
                      field.onChange(next);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact *</FormLabel>
                <FormControl>
                  <ContactSelect
                    aria-label="Contact"
                    companyId={companyId || undefined}
                    value={
                      field.value
                        ? {
                            id: field.value,
                            name: contactQuery.data
                              ? [contactQuery.data.data.firstName, contactQuery.data.data.lastName].filter(Boolean).join(" ")
                              : (quotation?.contactName ?? ""),
                          }
                        : undefined
                    }
                    onValueChange={(contact) => field.onChange(contact?.id ?? "")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dealId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deal</FormLabel>
                <FormControl>
                  <Select
                    value={field.value ?? NO_DEAL}
                    onValueChange={(value) => field.onChange(value === NO_DEAL ? null : value)}
                    disabled={!companyId}
                  >
                    <SelectTrigger className="w-full" aria-label="Deal">
                      <SelectValue placeholder={companyId ? "No deal" : "Pick a company first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_DEAL}>No deal</SelectItem>
                      {deals.map((deal) => (
                        <SelectItem key={deal.id} value={deal.id}>
                          {deal.name}
                        </SelectItem>
                      ))}
                      {/* Keep an already-linked deal selectable even if it's not in the first page of results. */}
                      {field.value && quotation?.dealId === field.value && !deals.some((deal) => deal.id === field.value) && (
                        <SelectItem value={field.value}>{quotation.dealName ?? "Linked deal"}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
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
                  <OwnerSelect value={field.value ?? undefined} onValueChange={(value) => field.onChange(value ?? null)} className="w-full" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="issueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                {!isEdit && <p className="small text-ink-muted">Leave blank for today.</p>}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="validUntil"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valid until</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                {!isEdit && <p className="small text-ink-muted">Leave blank for 30 days after the issue date.</p>}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="h2 mb-2">Line items</legend>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left">
                <tr>
                  <th className="p-2 font-medium">Description *</th>
                  <th className="w-24 p-2 text-right font-medium">Qty *</th>
                  <th className="w-36 p-2 text-right font-medium">Unit price (₹) *</th>
                  <th className="w-24 p-2 text-right font-medium">Disc. %</th>
                  <th className="w-32 p-2 text-right font-medium">Amount (₹)</th>
                  <th className="w-10 p-2" aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {lines.fields.map((line, index) => (
                  <tr key={line.id} className="border-t border-line align-top">
                    <td className="p-2">
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input aria-label={`Line ${index + 1} description`} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </td>
                    {(["quantity", "unitPrice", "discountPercent"] as const).map((key) => (
                      <td key={key} className="p-2">
                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.${key}`}
                          render={({ field: { value, onChange, ...field } }) => (
                            <FormItem>
                              <FormControl>
                                <NumericInput
                                  className="text-right"
                                  aria-label={`Line ${index + 1} ${key === "unitPrice" ? "unit price" : key === "discountPercent" ? "discount percent" : "quantity"}`}
                                  value={value}
                                  onValueChange={onChange}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </td>
                    ))}
                    <td className="gs-num p-2 pt-4 text-right text-ink-muted">{lineTotals?.[index] ?? "…"}</td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove line ${index + 1}`}
                        disabled={lines.fields.length === 1}
                        onClick={() => lines.remove(index)}
                      >
                        <Trash2 className="size-(--icon-md)" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {form.formState.errors.lineItems?.root?.message && (
            <p className="small text-danger">{form.formState.errors.lineItems.root.message}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={lines.fields.length >= MAX_QUOTATION_LINE_ITEMS}
            onClick={() => lines.append({ ...BLANK_LINE })}
          >
            <Plus className="size-(--icon-md)" aria-hidden="true" />
            Add line
          </Button>
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="discountPercent"
              render={({ field: { value, onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>Quotation discount (%)</FormLabel>
                  <FormControl>
                    <NumericInput value={value} onValueChange={onChange} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="taxPercent"
              render={({ field: { value, onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>GST (%)</FormLabel>
                  <FormControl>
                    <NumericInput value={value} onValueChange={onChange} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-2 sm:col-span-2">
              <label className="label text-ink-muted">Currency</label>
              <Input value="INR" disabled />
            </div>
          </div>
          <QuotationTotalsSummary
            totals={calculateInput ? totalsQuery.data?.data : undefined}
            discountPercent={discountPercent || "0"}
            taxPercent={taxPercent || DEFAULT_QUOTATION_TAX_PERCENT}
            pending={totalsQuery.isFetching}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Terms</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder="e.g. 50% advance, balance on delivery" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder="Printed on the quotation" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
