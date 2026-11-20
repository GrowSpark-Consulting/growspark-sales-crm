"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import type { ConvertLeadInput, LeadConversionResponse, LeadResponse } from "@growspark/shared";
import { apiPost, ApiError } from "@/lib/api-client";
import { LEADS_QUERY_KEY_ROOT, useLeadConversionMatches } from "@/hooks/use-leads";
import { usePipelineStages } from "@/hooks/use-pipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CompanySelect } from "@/components/pickers/company-select";
import { ContactSelect } from "@/components/pickers/contact-select";

type Mode = "link" | "create";
type PickedRecord = { id: string; name: string };

/**
 * Package 3.5's Convert dialog: three sections (Company, Contact, Deal),
 * prefilled from GET /leads/:id/conversion-matches, submitting once to
 * POST /leads/:id/convert. The server is the single source of truth for
 * every rule here (D46) — this dialog only offers sensible defaults and
 * keeps the one genuinely client-only requirement (a name before creating
 * a new company) from reaching the server as an avoidable 422.
 */
export function ConvertLeadDialog({ lead, trigger }: { lead: LeadResponse; trigger: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [result, setResult] = useState<LeadConversionResponse["data"] | null>(null);

  const [companyMode, setCompanyMode] = useState<Mode>("create");
  const [pickedCompany, setPickedCompany] = useState<PickedRecord | undefined>(undefined);
  const [companyName, setCompanyName] = useState("");

  const [contactMode, setContactMode] = useState<Mode>("create");
  const [pickedContact, setPickedContact] = useState<PickedRecord | undefined>(undefined);

  const [createDeal, setCreateDeal] = useState(true);
  const [dealName, setDealName] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [dealCloseDate, setDealCloseDate] = useState("");

  const matchesQuery = useLeadConversionMatches(lead.id, open);
  const { data: stagesData } = usePipelineStages();
  const firstOpenStage = (stagesData?.data ?? [])
    .filter((stage) => stage.type === "OPEN")
    .sort((a, b) => a.position - b.position)[0];

  const [initializedForOpen, setInitializedForOpen] = useState(false);

  // Adjusting state during render (React's own documented pattern for
  // "reset some state when a condition becomes true" — the same approach
  // CompanySelect/ContactSelect already use, D37), not a useEffect that
  // would call several setStates synchronously (flagged by this repo's
  // react-compiler lint rule, react-hooks/set-state-in-effect). Runs once
  // per dialog-open session, guarded by initializedForOpen; onOpenChange
  // below re-arms it on the next open.
  //
  // Gated on matchesQuery.isLoading having settled, not on matchesQuery.data
  // being present — the form sections below are kept unrendered while
  // isLoading is true (see JSX), so the user can never type into a field
  // before this runs. Checking .data alone would let a user's keystroke that
  // arrives between "dialog opened" and "matches finished loading" (a real
  // network round trip) get silently overwritten the instant matches do
  // arrive — found by this package's own test, not a hypothetical.
  if (open && !matchesQuery.isLoading && !initializedForOpen) {
    const companies = matchesQuery.data?.data.companies ?? [];
    const contacts = matchesQuery.data?.data.contacts ?? [];
    let companyDisplayName = lead.companyName ?? "";

    if (companies.length > 0) {
      setCompanyMode("link");
      setPickedCompany({ id: companies[0]!.id, name: companies[0]!.name });
      companyDisplayName = companies[0]!.name;
    } else {
      setCompanyMode("create");
      setCompanyName(lead.companyName ?? "");
    }

    if (contacts.length > 0) {
      setContactMode("link");
      const match = contacts[0]!;
      setPickedContact({ id: match.id, name: [match.firstName, match.lastName].filter(Boolean).join(" ") });
    } else {
      setContactMode("create");
      setPickedContact(undefined);
    }

    const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
    setDealName(companyDisplayName ? `${companyDisplayName} - ${leadName}` : leadName);
    setDealValue(lead.estimatedBudget ?? "");
    setDealCloseDate("");
    setCreateDeal(true);
    setBannerError(null);
    setResult(null);
    setInitializedForOpen(true);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setInitializedForOpen(false);
    }
  }

  const companyNameRequired = companyMode === "create" && !companyName.trim();
  const companyMissing = companyMode === "link" && !pickedCompany;
  const contactMissing = contactMode === "link" && !pickedContact;
  const canSubmit = !companyNameRequired && !companyMissing && !contactMissing;

  async function handleSubmit() {
    if (pending) return;
    if (!canSubmit) return;
    setPending(true);
    setBannerError(null);
    try {
      const body: ConvertLeadInput = {
        companyId: companyMode === "link" ? pickedCompany?.id : undefined,
        companyName: companyMode === "create" ? companyName.trim() : undefined,
        contactId: contactMode === "link" ? pickedContact?.id : undefined,
        createDeal,
        deal: createDeal
          ? {
              name: dealName.trim() || undefined,
              value: dealValue.trim() ? Number(dealValue) : undefined,
              expectedCloseDate: dealCloseDate || undefined,
            }
          : undefined,
      };
      const res = await apiPost<LeadConversionResponse>(`/api/v1/leads/${lead.id}/convert`, body);
      setResult(res.data);
      void queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY_ROOT] });
    } catch (error) {
      // A 409 (already converted, archived, or no longer QUALIFIED — D46)
      // means the lead's real state has moved on since this dialog opened;
      // refresh it so the page behind the dialog reflects the truth.
      setBannerError(error instanceof ApiError ? error.message : "Could not convert this lead. Please try again.");
      void queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY_ROOT, "detail", lead.id] });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Convert lead</DialogTitle>
          <DialogDescription>Link or create a company and contact, and optionally start a deal.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>{`${lead.firstName} was converted.`}</AlertDescription>
            </Alert>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/companies/${result.companyId}`} className="text-primary underline">
                  {result.createdCompany ? "View the new company" : "View the linked company"}
                </Link>
              </li>
              <li>
                <Link href={`/contacts/${result.contactId}`} className="text-primary underline">
                  {result.createdContact ? "View the new contact" : "View the linked contact"}
                </Link>
              </li>
              {result.dealId && (
                <li>
                  <Link href={`/deals/${result.dealId}`} className="text-primary underline">
                    View the new deal
                  </Link>
                </li>
              )}
            </ul>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6">
            {bannerError && (
              <Alert variant="destructive">
                <AlertDescription>{bannerError}</AlertDescription>
              </Alert>
            )}

            {matchesQuery.isLoading && <p className="small text-ink-muted">Looking for existing matches…</p>}

            {!matchesQuery.isLoading && (
              <>
                <section className="space-y-2">
                  <h3 className="h3">Company</h3>
                  <ModeToggle mode={companyMode} onChange={setCompanyMode} linkLabel="Link existing" createLabel="Create new" />
                  {companyMode === "link" ? (
                    <CompanySelect value={pickedCompany} onValueChange={setPickedCompany} aria-label="Company to link" />
                  ) : (
                    <div className="space-y-1">
                      <Label htmlFor="convert-company-name">Company name *</Label>
                      <Input
                        id="convert-company-name"
                        value={companyName}
                        onChange={(event) => setCompanyName(event.target.value)}
                      />
                    </div>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="h3">Contact</h3>
                  <ModeToggle mode={contactMode} onChange={setContactMode} linkLabel="Link existing" createLabel="Create new" />
                  {contactMode === "link" ? (
                    <>
                      <ContactSelect value={pickedContact} onValueChange={setPickedContact} aria-label="Contact to link" />
                      <p className="small text-ink-muted">
                        Only this contact&apos;s empty fields will be filled in from the lead — its company is never changed.
                      </p>
                    </>
                  ) : (
                    <p className="small text-ink-muted">A new contact will be created from this lead&apos;s name, email and phone.</p>
                  )}
                </section>

                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="h3">Deal</h3>
                    <Button
                      type="button"
                      variant={createDeal ? "default" : "outline"}
                      size="sm"
                      aria-pressed={createDeal}
                      onClick={() => setCreateDeal((value) => !value)}
                    >
                      {createDeal ? "Create a deal" : "Don't create a deal"}
                    </Button>
                  </div>
                  {createDeal && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="convert-deal-name">Deal name</Label>
                        <Input id="convert-deal-name" value={dealName} onChange={(event) => setDealName(event.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="convert-deal-value">Value (₹)</Label>
                        <Input
                          id="convert-deal-value"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={dealValue}
                          onChange={(event) => setDealValue(event.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="convert-deal-close">Expected close date</Label>
                        <Input
                          id="convert-deal-close"
                          type="date"
                          value={dealCloseDate}
                          onChange={(event) => setDealCloseDate(event.target.value)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label>Stage</Label>
                        <p className="body text-ink-muted">
                          {firstOpenStage ? firstOpenStage.name : "…"} (the pipeline&apos;s first open stage)
                        </p>
                      </div>
                    </div>
                  )}
                </section>

                <DialogFooter>
                  <Button onClick={handleSubmit} disabled={!canSubmit || pending}>
                    {pending ? "Converting…" : "Convert lead"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModeToggle({
  mode,
  onChange,
  linkLabel,
  createLabel,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
  linkLabel: string;
  createLabel: string;
}) {
  return (
    <div className="inline-flex rounded-md border border-line-strong p-0.5" role="group">
      <Button type="button" variant={mode === "link" ? "default" : "ghost"} size="sm" onClick={() => onChange("link")}>
        {linkLabel}
      </Button>
      <Button type="button" variant={mode === "create" ? "default" : "ghost"} size="sm" onClick={() => onChange("create")}>
        {createLabel}
      </Button>
    </div>
  );
}
