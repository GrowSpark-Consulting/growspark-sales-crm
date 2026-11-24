"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import type { CompanyResponse } from "@growspark/shared";
import { apiPost, ApiError } from "@/lib/api-client";
import { COMPANIES_QUERY_KEY_ROOT, useCompany } from "@/hooks/use-companies";
import { useUserOptions } from "@/hooks/use-user-options";
import { RecordLayout } from "@/components/ui/record-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { CompanyContactsTab } from "@/components/companies/company-contacts-tab";
import { DealsTab } from "@/components/deals/deals-tab";
import { QuotationsTab } from "@/components/quotations/quotations-tab";
import { RecordTimeline } from "@/components/activities/record-timeline";
import { formatDate, formatPhoneForDisplay } from "@/lib/format";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="label text-ink-muted">{label}</p>
      <p className="body">{value ?? <span className="text-ink-muted">—</span>}</p>
    </div>
  );
}

export function CompanyDetailPageClient({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const companyQuery = useCompany(companyId);
  const { data: userOptions } = useUserOptions();

  async function archive() {
    await apiPost(`/api/v1/companies/${companyId}/archive`);
    toast.success("Company archived.");
    void queryClient.invalidateQueries({ queryKey: [COMPANIES_QUERY_KEY_ROOT] });
  }

  async function restore() {
    await apiPost(`/api/v1/companies/${companyId}/restore`);
    toast.success("Company restored.");
    void queryClient.invalidateQueries({ queryKey: [COMPANIES_QUERY_KEY_ROOT] });
  }

  if (companyQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (companyQuery.isError || !companyQuery.data) {
    const notFound = companyQuery.error instanceof ApiError && companyQuery.error.status === 404;
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {notFound ? "This company does not exist, or was deleted." : "Could not load this company."}
        </AlertDescription>
      </Alert>
    );
  }

  const company: CompanyResponse = companyQuery.data.data;
  const ownerName = userOptions?.data.find((u) => u.id === company.ownerId)?.name;

  return (
    <RecordLayout
      title={company.name}
      statusBadge={company.archivedAt ? <Badge variant="danger">Archived</Badge> : undefined}
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/companies/${company.id}/edit`}>
              <Pencil className="size-(--icon-md)" aria-hidden="true" />
              Edit
            </Link>
          </Button>
          {company.archivedAt ? (
            <ConfirmActionDialog
              triggerLabel="Restore"
              title="Restore company"
              description={`${company.name} will reappear in the active companies list.`}
              confirmLabel="Restore"
              onConfirm={restore}
            />
          ) : (
            <ConfirmActionDialog
              triggerLabel="Archive"
              title="Archive company"
              description={`${company.name} will be hidden from the active companies list. You can restore it later.`}
              confirmLabel="Archive"
              destructive
              onConfirm={archive}
            />
          )}
        </>
      }
      keyFields={[
        { label: "Owner", value: ownerName ?? "Unassigned" },
        { label: "Industry", value: company.industry },
        { label: "Phone", value: formatPhoneForDisplay(company.phone) },
        { label: "Email", value: company.email },
      ]}
      tabs={[
        {
          value: "overview",
          label: "Overview",
          content: (
            <div className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
              <Field label="Legal name" value={company.legalName} />
              <Field
                label="Website"
                value={
                  company.website ? (
                    <a href={company.website} target="_blank" rel="noreferrer" className="text-primary underline">
                      {company.website}
                    </a>
                  ) : null
                }
              />
              <Field label="Employee size" value={company.employeeSize} />
              <Field label="Annual revenue" value={company.annualRevenue ? `₹ ${company.annualRevenue}` : null} />
              <Field
                label="Address"
                value={[company.addressLine1, company.addressLine2, company.city, company.state, company.postalCode, company.country]
                  .filter(Boolean)
                  .join(", ") || null}
              />
              <Field label="Created" value={formatDate(company.createdAt)} />
              <div className="sm:col-span-2">
                <Field label="Description" value={company.description} />
              </div>
            </div>
          ),
        },
        {
          value: "contacts",
          label: "Contacts",
          content: <CompanyContactsTab companyId={company.id} companyName={company.name} />,
        },
        {
          value: "deals",
          label: "Deals",
          content: (
            <DealsTab
              companyId={company.id}
              addHref={`/deals/new?companyId=${company.id}`}
              emptyLabel={`No deals yet for ${company.name}.`}
            />
          ),
        },
        {
          value: "quotations",
          label: "Quotations",
          content: (
            <QuotationsTab
              companyId={company.id}
              addHref={`/quotations/new?companyId=${company.id}`}
              emptyLabel={`No quotations yet for ${company.name}.`}
            />
          ),
        },
        { value: "timeline", label: "Timeline", content: <RecordTimeline owner="companies" recordId={company.id} /> },
      ]}
    />
  );
}
