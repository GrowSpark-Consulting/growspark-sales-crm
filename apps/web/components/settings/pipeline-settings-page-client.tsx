"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "lucide-react";
import { createPipelineStageSchema } from "@growspark/shared";
import { apiDelete, apiPatch, apiPost, apiPut, ApiError } from "@/lib/api-client";
import { useInvalidateSettings, usePipelineStageSettings, useRequireAdmin } from "@/hooks/use-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { SettingItemDialog } from "@/components/settings/setting-item-dialog";
import { moveId } from "@/components/settings/lead-sources-settings-page-client";

const TYPE_LABEL = { OPEN: "Open", WON: "Won", LOST: "Lost" } as const;
const TYPE_BADGE = { OPEN: "default", WON: "success", LOST: "danger" } as const;

/** /settings/pipeline — Admin only. */
export function PipelineSettingsPageClient() {
  const isAdmin = useRequireAdmin();
  const query = usePipelineStageSettings(isAdmin);
  const invalidate = useInvalidateSettings();
  const [reordering, setReordering] = useState(false);

  if (!isAdmin) return null;
  const stages = query.data?.data ?? [];
  const openIds = stages.filter((stage) => stage.type === "OPEN").map((stage) => stage.id);

  async function reorder(openIndex: number, direction: -1 | 1) {
    setReordering(true);
    try {
      await apiPut("/api/v1/settings/pipeline-stages/order", { ids: moveId(openIds, openIndex, direction) });
      await invalidate.stages();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not change the order.");
    } finally {
      setReordering(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 text-sm text-ink-muted">
          <p>
            Open stages appear on the Deals board in this order; new and reopened deals start in the first one. Won and
            Lost always come last.
          </p>
          <p>
            Changing a stage’s probability applies to deals moved into it from now on — deals already in the stage
            keep their current probability. A stage can only be deleted if no deal has ever been in it.
          </p>
        </div>
        <SettingItemDialog
          triggerLabel="Add stage"
          triggerVariant="default"
          triggerSize="default"
          title="Add pipeline stage"
          description="The new stage is added after the last open stage. You can move it afterwards."
          submitLabel="Add"
          schema={createPipelineStageSchema}
          initialValues={{ name: "", probability: 50 }}
          probability="editable"
          onSubmit={async (values) => {
            await apiPost("/api/v1/settings/pipeline-stages", values);
            await invalidate.stages();
            toast.success(`Stage "${values.name.trim()}" added.`);
          }}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Order</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Probability</TableHead>
            <TableHead className="text-right">Deals</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {stages.map((stage) => {
            const openIndex = openIds.indexOf(stage.id);
            const isOpen = stage.type === "OPEN";
            return (
              <TableRow key={stage.id}>
                <TableCell>
                  {isOpen && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${stage.name} up`}
                        disabled={openIndex === 0 || reordering}
                        onClick={() => reorder(openIndex, -1)}
                      >
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${stage.name} down`}
                        disabled={openIndex === openIds.length - 1 || reordering}
                        onClick={() => reorder(openIndex, 1)}
                      >
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{stage.name}</TableCell>
                <TableCell>
                  <Badge variant={TYPE_BADGE[stage.type]}>{TYPE_LABEL[stage.type]}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{stage.probability}%</TableCell>
                <TableCell className="text-right tabular-nums">{stage.dealCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <SettingItemDialog
                      triggerLabel="Edit"
                      title={`Edit “${stage.name}”`}
                      submitLabel="Save"
                      // The form always holds both fields, so the create schema validates it; only
                      // open stages send probability (the dialog drops it when read-only).
                      schema={createPipelineStageSchema}
                      initialValues={{ name: stage.name, probability: stage.probability }}
                      probability={isOpen ? "editable" : "readonly"}
                      onSubmit={async (values) => {
                        await apiPatch(`/api/v1/settings/pipeline-stages/${stage.id}`, values);
                        await invalidate.stages();
                        toast.success("Stage saved.");
                      }}
                    />
                    {isOpen &&
                      (stage.deletable ? (
                        <ConfirmActionDialog
                          triggerLabel="Delete"
                          title={`Delete “${stage.name}”?`}
                          description="No deal has ever been in this stage, so it can be removed. This cannot be undone."
                          confirmLabel="Delete"
                          destructive
                          onConfirm={async () => {
                            await apiDelete(`/api/v1/settings/pipeline-stages/${stage.id}`);
                            await invalidate.stages();
                            toast.success(`Stage "${stage.name}" deleted.`);
                          }}
                        />
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title="Deals have been in this stage, so it cannot be deleted. Rename it instead."
                        >
                          Delete
                        </Button>
                      ))}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
