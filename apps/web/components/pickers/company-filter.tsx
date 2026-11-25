"use client";

import { useCompany } from "@/hooks/use-companies";
import { CompanySelect } from "@/components/pickers/company-select";

export interface CompanyFilterProps {
  /** The company id from the page address, or undefined for "Any company". */
  companyId: string | undefined;
  onCompanyIdChange: (companyId: string | undefined) => void;
  className?: string;
}

/**
 * D97: the list pages' company filter (Deals, Quotations). Replaces a plain
 * Select that listed only the first 100 companies, so any company can be
 * filtered on. The selected company's name is looked up by id, since the
 * page address carries only the id.
 */
export function CompanyFilter({ companyId, onCompanyIdChange, className = "w-52" }: CompanyFilterProps) {
  const { data, isError } = useCompany(companyId);
  const name = data?.data.name ?? (isError ? "Unknown company" : undefined);
  const value = companyId && name ? { id: companyId, name } : undefined;

  return (
    <CompanySelect
      className={className}
      aria-label="Filter by company"
      placeholder="Any company"
      clearOption="Any company"
      keepValueWhileTyping
      value={value}
      onValueChange={(next) => onCompanyIdChange(next?.id)}
    />
  );
}
