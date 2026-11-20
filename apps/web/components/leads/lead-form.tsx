"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  leadCreatableFields,
  PRIORITIES,
  type CreateLeadInput,
  type LeadResponse,
  type DuplicateMatch,
} from "@growspark/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OwnerSelect } from "@/components/pickers/owner-select";
import { useLeadSources } from "@/hooks/use-lead-sources";
import { stripEmptyOptionalFields } from "@/lib/form-utils";
import { apiGet } from "@/lib/api-client";
import { handleApiFormError } from "@/lib/handle-form-error";
import { toDatetimeLocalValue, fromDatetimeLocalValue } from "@/lib/datetime-local";
import { priorityLabel } from "@/lib/lead-presentation";

// z.coerce.number() (estimatedBudget) has an unknown input type in Zod v4 —
// same issue, same fix, as Company's companyFormSchema (D38).
const leadBaseFormFields = {
  ...leadCreatableFields,
  estimatedBudget: z.number().nonnegative("Estimated budget cannot be negative").optional(),
};

const emailOrPhoneRefine = {
  check: (data: { email?: string; phone?: string }) => Boolean(data.email?.trim()) || Boolean(data.phone?.trim()),
  options: { message: "Provide an email or a phone number", path: ["email"] } as { message: string; path: string[] },
};

// Create includes `requirement` (the manual equivalent of a captured
// enquiry); edit deliberately does not — "the lead keeps its original
// enquiry fields ... read-only after creation" (2.3 brief, D35) applies to
// manually-entered leads too, not just website-sourced ones.
const createLeadFormSchema = z
  .object({ ...leadBaseFormFields, requirement: z.string().trim().max(5000, "Requirement is too long").optional() })
  .refine(emailOrPhoneRefine.check, emailOrPhoneRefine.options);

const editLeadFormSchema = z.object(leadBaseFormFields).refine(emailOrPhoneRefine.check, emailOrPhoneRefine.options);

type LeadFormValues = CreateLeadInput;

/** Exported so a test can assert the cleanup's reset target is genuinely blank (D42). */
export function leadToFormValues(lead?: LeadResponse): LeadFormValues {
  return {
    firstName: lead?.firstName ?? "",
    lastName: lead?.lastName ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    companyName: lead?.companyName ?? "",
    website: lead?.website ?? "",
    jobTitle: lead?.jobTitle ?? "",
    industry: lead?.industry ?? "",
    sourceId: lead?.sourceId ?? "",
    sourceDetail: lead?.sourceDetail ?? "",
    priority: lead?.priority ?? "MEDIUM",
    ownerId: lead?.ownerId ?? undefined,
    purchaseTimeline: lead?.purchaseTimeline ?? "",
    nextFollowUpAt: lead?.nextFollowUpAt ?? undefined,
    notes: lead?.notes ?? "",
    requirement: lead?.requirement ?? "",
  };
}

export interface LeadFormProps {
  mode: "create" | "edit";
  /** Present in edit mode; omitted when creating. */
  lead?: LeadResponse;
  onSubmit: (values: CreateLeadInput) => Promise<unknown>;
  submitLabel: string;
  pendingLabel: string;
  onCancel: () => void;
}

export function LeadForm({ mode, lead, onSubmit, submitLabel, pendingLabel, onCancel }: LeadFormProps) {
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const { data: sourcesData } = useLeadSources();
  const sources = sourcesData?.data ?? [];

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(mode === "create" ? createLeadFormSchema : editLeadFormSchema),
    defaultValues: leadToFormValues(lead),
  });

  // D42: with cacheComponents enabled, Next.js hides a navigated-away-from
  // page using React's Activity ("hidden" mode) instead of unmounting it, so
  // useState/react-hook-form values persist when the user returns — Activity
  // still runs effect cleanup on hide, exactly like a real unmount (Next.js's
  // own "Preserving UI state across navigations" guide). A create form must
  // always open blank, regardless of whether the user submitted, cancelled,
  // or navigated away mid-draft, so this unconditionally resets to blank on
  // every hide, not just after a successful submit.
  useLayoutEffect(() => {
    if (mode !== "create") return;
    return () => {
      form.reset(leadToFormValues());
      setDuplicates([]);
      setBannerError(null);
    };
  }, [mode, form]);

  // D40: preselect a "Manual" source on create rather than forcing an
  // explicit choice — the seed always has a lead source named exactly
  // "Manual" (apps/api/prisma/seed-lib.ts), so this matches by name, not by
  // list position (the first/default source is actually "Website"). Only
  // applies while nothing has been chosen yet, so it never overrides a
  // user's own selection, and re-applies after a D42 reset-to-blank.
  useEffect(() => {
    if (mode !== "create") return;
    if (form.getValues("sourceId")) return;
    const manual = sources.find((source) => source.name === "Manual");
    if (manual) form.setValue("sourceId", manual.id);
  }, [mode, sources, form]);

  /**
   * D29: duplicates warn, never block. Unlike Companies (D38, no dedicated
   * endpoint), Leads has a real one (GET /leads/duplicates, D35) that
   * performs the same normalised-exact match the create/update endpoints
   * use — this is the authoritative check, not an approximation.
   */
  async function checkDuplicates() {
    const { email, phone, companyName } = form.getValues();
    if (!email?.trim() && !phone?.trim() && !companyName?.trim()) {
      setDuplicates([]);
      return;
    }
    try {
      const params = new URLSearchParams();
      if (email?.trim()) params.set("email", email.trim());
      if (phone?.trim()) params.set("phone", phone.trim());
      if (companyName?.trim()) params.set("companyName", companyName.trim());
      if (lead?.id) params.set("excludeId", lead.id);
      const result = await apiGet<{ data: DuplicateMatch[] }>(`/api/v1/leads/duplicates?${params.toString()}`);
      setDuplicates(result.data);
    } catch {
      // A failed live check is not worth surfacing — the authoritative
      // server-side check still runs on submit either way.
    }
  }

  async function handleSubmit(values: LeadFormValues) {
    setBannerError(null);
    setSubmitting(true);
    try {
      await onSubmit(stripEmptyOptionalFields(values) as CreateLeadInput);
    } catch (error) {
      setBannerError(handleApiFormError(error, form));
    } finally {
      setSubmitting(false);
    }
  }

  const duplicateReasonLabel: Record<DuplicateMatch["reason"], string> = {
    email: "email",
    phone: "phone",
    companyName: "company name",
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6" noValidate>
        {bannerError && (
          <Alert variant="destructive">
            <AlertDescription>{bannerError}</AlertDescription>
          </Alert>
        )}

        {duplicates.length > 0 && (
          <Alert variant="warning">
            <AlertDescription>
              <strong>This might already exist.</strong> Saving will still work — check before you create a
              duplicate:
              <ul className="mt-1 list-inside list-disc">
                {duplicates.map((match) => (
                  <li key={`${match.id}-${match.reason}`}>
                    <Link href={`/leads/${match.id}`} className="underline" target="_blank">
                      Matching {duplicateReasonLabel[match.reason]}
                    </Link>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    {...field}
                    onBlur={() => {
                      field.onBlur();
                      void checkDuplicates();
                    }}
                  />
                </FormControl>
                <FormMessage />
                <p className="small text-ink-muted">Provide an email or a phone number.</p>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <PhoneInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={() => {
                      field.onBlur();
                      void checkDuplicates();
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onBlur={() => {
                      field.onBlur();
                      void checkDuplicates();
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. https://example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="jobTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job title</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="industry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Industry</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                <FormLabel>Source *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a source" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sourceDetail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source detail</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Referral / Priya Shah" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PRIORITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {priorityLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            name="estimatedBudget"
            render={({ field: { value, onChange, ...field } }) => (
              <FormItem>
                <FormLabel>Estimated budget</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    placeholder="e.g. 500000"
                    value={value ?? ""}
                    onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.valueAsNumber)}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="purchaseTimeline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase timeline</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Next quarter" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nextFollowUpAt"
            render={({ field: { value, onChange, ...field } }) => (
              <FormItem>
                <FormLabel>Next follow-up</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    value={toDatetimeLocalValue(value)}
                    onChange={(event) => onChange(fromDatetimeLocalValue(event.target.value) ?? null)}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {mode === "create" && (
          <FormField
            control={form.control}
            name="requirement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Requirement</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="What does the prospect need?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
