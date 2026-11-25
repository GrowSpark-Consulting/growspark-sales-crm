"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileUp } from "lucide-react";
import {
  IMPORT_FIELDS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  type ImportCommitResponse,
  type ImportEntity,
  type ImportPreviewResponse,
  type ImportPreviewRow,
} from "@growspark/shared";
import { apiPost, ApiError } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Step = "upload" | "map" | "preview" | "done";
type Preview = ImportPreviewResponse["data"];
type Result = ImportCommitResponse["data"];
type RowFilter = "all" | ImportPreviewRow["status"];

const NOT_IMPORTED = "__none__";
const NOUN: Record<ImportEntity, { plural: string; singular: string; listHref: string; queryKey: string }> = {
  leads: { plural: "leads", singular: "lead", listHref: "/leads", queryKey: "leads" },
  contacts: { plural: "contacts", singular: "contact", listHref: "/contacts", queryKey: "contacts" },
};
const STATUS_BADGE = {
  ok: { label: "Ready", variant: "success" },
  duplicate: { label: "Duplicate", variant: "warning" },
  error: { label: "Error", variant: "danger" },
} as const;

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

/** Saves text the server produced as a file — the errors CSV is never stored anywhere. */
function downloadText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Upload → Map columns → Preview → Import (D95). The browser only reads the
 * file and shows what the server says: parsing, mapping suggestions, row
 * validation, duplicates and the final import all happen on the server, and
 * the import re-checks everything rather than trusting this preview.
 */
export function ImportWizard({ entity }: { entity: ImportEntity }) {
  const noun = NOUN[entity];
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<(string | null)[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [filter, setFilter] = useState<RowFilter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = IMPORT_FIELDS[entity];

  async function runPreview(text: string, nextMapping?: (string | null)[]) {
    const response = await apiPost<ImportPreviewResponse>(`/api/v1/imports/${entity}/preview`, {
      csv: text,
      ...(nextMapping ? { mapping: nextMapping } : {}),
    });
    setPreview(response.data);
    setMapping(response.data.mapping);
    return response.data;
  }

  async function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) {
      setError("The file is larger than 1 MB. Split it into smaller files.");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      setCsv(text);
      setFileName(file.name);
      await runPreview(text);
      setStep("map");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function checkRows() {
    setError(null);
    setBusy(true);
    try {
      const data = await runPreview(csv, mapping);
      if (data.mappingErrors.length === 0) {
        setFilter("all");
        setStep("preview");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setError(null);
    setBusy(true);
    try {
      const response = await apiPost<ImportCommitResponse>(`/api/v1/imports/${entity}/commit`, { csv, mapping });
      setResult(response.data);
      setStep("done");
      void queryClient.invalidateQueries({ queryKey: [noun.queryKey] });
      if (entity === "contacts") void queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep("upload");
    setCsv("");
    setFileName("");
    setPreview(null);
    setMapping([]);
    setResult(null);
    setError(null);
  }

  const banner = error && (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  if (step === "upload") {
    return (
      <div className="max-w-2xl space-y-4">
        <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <h2 className="h3">1. Choose a CSV file</h2>
          <p className="text-sm text-ink-muted">
            One {noun.singular} per row, with a header row naming the columns. Up to {IMPORT_MAX_ROWS.toLocaleString("en-IN")} rows
            and 1 MB. From Excel, use <span className="font-medium">File → Save As → CSV UTF-8</span>. Nothing is saved until you
            confirm on the last step, and the file itself is never stored.
          </p>
          {banner}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            <Button asChild disabled={busy}>
              <label htmlFor="import-file" className="cursor-pointer">
                <FileUp className="size-(--icon-md)" aria-hidden="true" />
                {busy ? "Reading…" : "Choose CSV file"}
              </label>
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/v1/imports/${entity}/template`} download>
                <Download className="size-(--icon-md)" aria-hidden="true" />
                Download a sample file
              </a>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  if (step === "map" && preview) {
    const chosen = new Set(mapping.filter(Boolean));
    return (
      <div className="max-w-4xl space-y-4">
        <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <h2 className="h3">2. Match the columns</h2>
          <p className="text-sm text-ink-muted">
            <span className="font-medium text-ink">{fileName}</span> — {preview.summary.totalRows} rows. For each column in your
            file, choose which field it fills, or “Don’t import”. Each row needs a name and an email or phone.
            {entity === "leads" && " Columns you don’t import are still kept on each lead, under “Other captured answers”."}
          </p>
          {banner}
          {preview.mappingErrors.length > 0 && (
            <Alert variant="warning">
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {preview.mappingErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column in your file</TableHead>
                <TableHead>First value</TableHead>
                <TableHead className="w-72">Import into</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.headers.map((header, index) => {
                const value = mapping[index] ?? null;
                const hint = fields.find((field) => field.key === value);
                return (
                  <TableRow key={`${index}-${header}`}>
                    <TableCell className="font-medium">{header}</TableCell>
                    <TableCell className="max-w-64 truncate text-ink-muted">{preview.samples[index] || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={value ?? NOT_IMPORTED}
                        onValueChange={(next) =>
                          setMapping((current) => current.map((item, i) => (i === index ? (next === NOT_IMPORTED ? null : next) : item)))
                        }
                      >
                        <SelectTrigger className="w-full" aria-label={`Import column “${header}” into`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NOT_IMPORTED}>Don’t import</SelectItem>
                          {fields.map((field) => (
                            <SelectItem key={field.key} value={field.key} disabled={field.key !== value && chosen.has(field.key)}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {hint && "hint" in hint && hint.hint && <p className="mt-1 text-xs text-ink-muted">{hint.hint}</p>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={reset}>
              Choose a different file
            </Button>
            <Button onClick={() => void checkRows()} disabled={busy}>
              {busy ? "Checking…" : "Check rows"}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  if (step === "preview" && preview) {
    const { summary } = preview;
    const rows = filter === "all" ? preview.rows : preview.rows.filter((row) => row.status === filter);
    return (
      <div className="space-y-4">
        <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <h2 className="h3">3. Check before importing</h2>
          <dl className="flex flex-wrap gap-6 text-sm">
            <div>
              <dt className="text-ink-muted">Ready to import</dt>
              <dd className="text-lg font-semibold text-ink">{summary.ready}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Duplicates (skipped)</dt>
              <dd className="text-lg font-semibold text-ink">{summary.duplicates}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Errors (skipped)</dt>
              <dd className="text-lg font-semibold text-ink">{summary.errors}</dd>
            </div>
            {summary.blankRowsSkipped > 0 && (
              <div>
                <dt className="text-ink-muted">Blank rows ignored</dt>
                <dd className="text-lg font-semibold text-ink">{summary.blankRowsSkipped}</dd>
              </div>
            )}
          </dl>
          {summary.companiesToCreate.length > 0 && (
            <p className="text-sm">
              <span className="font-medium">New companies that will be created ({summary.companiesToCreate.length}):</span>{" "}
              {summary.companiesToCreate.join(", ")}
            </p>
          )}
          {summary.keptAsCapturedFields.length > 0 && (
            <p className="text-sm text-ink-muted">
              Kept on each lead as extra details (not imported into a field): {summary.keptAsCapturedFields.join(", ")}.
            </p>
          )}
          <p className="text-sm text-ink-muted">
            Rows with a problem are skipped; the rest are imported together. After importing you can download the skipped
            rows, fix them and import them again. A duplicate is a {noun.singular} whose email is already in the CRM (archived
            ones count) or appears earlier in this file.
          </p>
          {banner}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs value={filter} onValueChange={(value) => setFilter(value as RowFilter)}>
              <TabsList>
                <TabsTrigger value="all">All ({preview.rows.length})</TabsTrigger>
                <TabsTrigger value="ok">Ready ({summary.ready})</TabsTrigger>
                <TabsTrigger value="duplicate">Duplicates ({summary.duplicates})</TabsTrigger>
                <TabsTrigger value="error">Errors ({summary.errors})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("map")}>
                Back to columns
              </Button>
              <Button onClick={() => void runImport()} disabled={busy || summary.ready === 0}>
                {busy ? "Importing…" : `Import ${summary.ready} ${summary.ready === 1 ? noun.singular : noun.plural}`}
              </Button>
            </div>
          </div>
        </section>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Row</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No rows here.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.rowNumber}>
                <TableCell className="tabular-nums">{row.rowNumber}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[row.status].variant}>{STATUS_BADGE[row.status].label}</Badge>
                </TableCell>
                <TableCell className="max-w-48 truncate">{row.name || "—"}</TableCell>
                <TableCell className="max-w-56 truncate">{row.email ?? "—"}</TableCell>
                <TableCell>{row.phone ?? "—"}</TableCell>
                <TableCell className="max-w-48 truncate">
                  {row.companyName ?? "—"}
                  {row.createsCompany && (
                    <Badge className="ml-2" variant="info">
                      New
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-md text-sm">
                  {row.errors.map((message) => (
                    <p key={message} className="text-danger">
                      {message}
                    </p>
                  ))}
                  {row.notes.map((message) => (
                    <p key={message} className="text-ink-muted">
                      {message}
                    </p>
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (step === "done" && result) {
    const skipped = result.skippedDuplicates + result.errors;
    return (
      <div className="max-w-2xl space-y-4">
        <section className="space-y-3 rounded-lg border border-line bg-surface p-4" aria-live="polite">
          <h2 className="h3">Import finished</h2>
          <ul className="space-y-1 text-sm">
            <li>
              <span className="font-semibold">{result.imported}</span> {result.imported === 1 ? noun.singular : noun.plural} imported
            </li>
            {result.companiesCreated > 0 && (
              <li>
                <span className="font-semibold">{result.companiesCreated}</span> new{" "}
                {result.companiesCreated === 1 ? "company" : "companies"} created
              </li>
            )}
            <li>
              <span className="font-semibold">{result.skippedDuplicates}</span> skipped as duplicates
            </li>
            <li>
              <span className="font-semibold">{result.errors}</span> skipped because of errors
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            {result.errorsCsv && (
              <Button variant="outline" onClick={() => downloadText(result.errorsCsv!, `${entity}-import-skipped-rows.csv`)}>
                <Download className="size-(--icon-md)" aria-hidden="true" />
                Download the {skipped} skipped {skipped === 1 ? "row" : "rows"}
              </Button>
            )}
            <Button asChild>
              <Link href={noun.listHref}>Go to {noun.plural}</Link>
            </Button>
            <Button variant="ghost" onClick={reset}>
              Import another file
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return null;
}
