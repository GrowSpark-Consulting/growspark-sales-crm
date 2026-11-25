"use client";

import type { CompanyResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";
import { COMPANIES_QUERY_KEY_ROOT } from "@/hooks/use-companies";
import { PICKER_PAGE_SIZE, RecordCombobox, type RecordOptionsPage } from "@/components/pickers/record-combobox";

export interface CompanySelectProps {
  value: { id: string; name: string } | undefined;
  onValueChange: (value: { id: string; name: string } | undefined) => void;
  placeholder?: string;
  /** For list filters: a first option that clears the value, e.g. "Any company". */
  clearOption?: string;
  /** For list filters — see RecordCombobox. */
  keepValueWhileTyping?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}

/**
 * Exported for tests. Active (non-archived) companies of the caller's
 * organisation, A–Z — GET /companies already scopes by organisation and
 * hides archived records unless `archived=true` is asked for.
 */
export async function loadCompanyOptions(query: string): Promise<RecordOptionsPage> {
  const params = new URLSearchParams({ page: "1", pageSize: String(PICKER_PAGE_SIZE), sort: "name:asc" });
  if (query) params.set("q", query);
  const result = await apiGet<{ data: CompanyResponse[]; meta: { total: number } }>(`/api/v1/companies?${params}`);
  return {
    options: result.data.map((company) => ({ id: company.id, name: company.name, description: company.industry })),
    total: result.meta.total,
  };
}

/** D97: company search-and-pick; shows the first companies as soon as it is opened. */
export function CompanySelect({ placeholder = "Search companies…", ...props }: CompanySelectProps) {
  return (
    <RecordCombobox
      {...props}
      placeholder={placeholder}
      queryKeyPrefix={[COMPANIES_QUERY_KEY_ROOT]}
      loadOptions={loadCompanyOptions}
      noun={{ one: "company", many: "companies" }}
    />
  );
}
