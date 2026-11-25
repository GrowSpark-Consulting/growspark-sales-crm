"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "lucide-react";
import { createLeadSourceSchema, type SettingsLeadSourceResponse } from "@growspark/shared";
import { apiPatch, apiPost, apiPut, ApiError } from "@/lib/api-client";
import { useInvalidateSettings, useLeadSourceSettings, useRequireAdmin } from "@/hooks/use-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { SettingItemDialog } from "@/components/settings/setting-item-dialog";

/** Moves one id up or down in a list, returning the new order. */
export function moveId(ids: string[], index: number, direction: -1 | 1): string[] {
  const next = [...ids];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** /settings/lead-sources — Admin only. */
export function LeadSourcesSettingsPageClient() {
  const isAdmin = useRequireAdmin();
  const query = useLeadSourceSettings(isAdmin);
  const invalidate = useInvalidateSettings();
  const [reordering, setReordering] = useState(false);

  if (!isAdmin) return null;
  const sources = query.data?.data ?? [];

  async function reorder(index: number, direction: -1 | 1) {
    setReordering(true);
    try {
      await apiPut("/api/v1/settings/lead-sources/order", { ids: moveId(sources.map((s) => s.id), index, direction) });
      await invalidate.leadSources();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not change the order.");
    } finally {
      setReordering(false);
    }
  }

  async function setActive(source: SettingsLeadSourceResponse, isActive: boolean) {
    await apiPatch(`/api/v1/settings/lead-sources/${source.id}`, { isActive });
    await invalidate.leadSources();
    toast.success(isActive ? `"${source.name}" reactivated.` : `"${source.name}" deactivated.`);
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-ink-muted">
          The order here is the order of the Source list on lead and deal forms. A deactivated source can no longer be
          chosen, but leads that already have it keep it. Sources marked “System” are used by the application itself
          and cannot be renamed or deactivated.
        </p>
        <SettingItemDialog
          triggerLabel="Add source"
          triggerVariant="default"
          triggerSize="default"
          title="Add lead source"
          submitLabel="Add"
          schema={createLeadSourceSchema}
          initialValues={{ name: "" }}
          onSubmit={async (values) => {
            await apiPost("/api/v1/settings/lead-sources", values);
            await invalidate.leadSources();
            toast.success(`"${values.name.trim()}" added.`);
          }}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Order</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {sources.map((source, index) => (
            <TableRow key={source.id}>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${source.name} up`}
                    disabled={index === 0 || reordering}
                    onClick={() => reorder(index, -1)}
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${source.name} down`}
                    disabled={index === sources.length - 1 || reordering}
                    onClick={() => reorder(index, 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-medium">{source.name}</span>
                {source.locked && (
                  <Badge className="ml-2" variant="info">
                    System
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={source.isActive ? "success" : "default"}>{source.isActive ? "Active" : "Inactive"}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{source.leadCount}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {!source.locked && (
                    <>
                      <SettingItemDialog
                        triggerLabel="Rename"
                        title={`Rename “${source.name}”`}
                        description={
                          source.leadCount > 0
                            ? `The ${source.leadCount} lead(s) with this source will show the new name.`
                            : undefined
                        }
                        submitLabel="Save"
                        schema={createLeadSourceSchema}
                        initialValues={{ name: source.name }}
                        onSubmit={async (values) => {
                          await apiPatch(`/api/v1/settings/lead-sources/${source.id}`, values);
                          await invalidate.leadSources();
                          toast.success("Source renamed.");
                        }}
                      />
                      {source.isActive ? (
                        <ConfirmActionDialog
                          triggerLabel="Deactivate"
                          title={`Deactivate “${source.name}”?`}
                          description="It will no longer be offered on lead and deal forms. Existing leads keep it, and you can reactivate it at any time."
                          confirmLabel="Deactivate"
                          onConfirm={() => setActive(source, false)}
                        />
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => void setActive(source, true).catch(() => toast.error("Could not reactivate."))}>
                          Reactivate
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
