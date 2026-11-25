"use client";

import { useCallback } from "react";
import type { ContactResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";
import { CONTACTS_QUERY_KEY_ROOT } from "@/hooks/use-contacts";
import { PICKER_PAGE_SIZE, RecordCombobox, type RecordOptionsPage } from "@/components/pickers/record-combobox";

export interface ContactSelectProps {
  value: { id: string; name: string } | undefined;
  onValueChange: (value: { id: string; name: string } | undefined) => void;
  /** Narrows the options to one company's contacts (dependent field). */
  companyId?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}

function contactName(contact: { firstName: string; lastName: string | null }): string {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

/** Exported for tests. Active contacts of the caller's organisation, A–Z by first name, optionally one company's only. */
export async function loadContactOptions(query: string, companyId?: string): Promise<RecordOptionsPage> {
  const params = new URLSearchParams({ page: "1", pageSize: String(PICKER_PAGE_SIZE), sort: "firstName:asc" });
  if (query) params.set("q", query);
  if (companyId) params.set("companyId", companyId);
  const result = await apiGet<{ data: ContactResponse[]; meta: { total: number } }>(`/api/v1/contacts?${params}`);
  return {
    options: result.data.map((contact) => ({
      id: contact.id,
      name: contactName(contact),
      description: contact.email ?? contact.jobTitle,
    })),
    total: result.meta.total,
  };
}

/** D97: contact search-and-pick; shows the first contacts (of `companyId`, when given) as soon as it is opened. */
export function ContactSelect({ companyId, placeholder = "Search contacts…", ...props }: ContactSelectProps) {
  const loadOptions = useCallback((query: string) => loadContactOptions(query, companyId), [companyId]);
  return (
    <RecordCombobox
      {...props}
      placeholder={placeholder}
      queryKeyPrefix={[CONTACTS_QUERY_KEY_ROOT, { companyId: companyId ?? null }]}
      loadOptions={loadOptions}
      noun={{ one: "contact", many: "contacts" }}
    />
  );
}
