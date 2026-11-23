"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ActivityComposer } from "@/components/activities/activity-composer";
import type { TimelineOwner } from "@/hooks/use-activities";

export interface AddFollowUpDialogProps {
  owner: TimelineOwner;
  recordId: string;
  /** Shown in the dialog title, e.g. the lead's name or the deal's name. */
  recordLabel: string;
}

/**
 * A small "Add follow-up" quick action for the Today workspace: opens the
 * same ActivityComposer used on every record's own detail page, inside a
 * dialog, so a task/call/meeting/note can be logged against that record
 * without navigating away. Closes itself once the activity is saved.
 */
export function AddFollowUpDialog({ owner, recordId, recordLabel }: AddFollowUpDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Add follow-up
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add follow-up for {recordLabel}</DialogTitle>
        </DialogHeader>
        <ActivityComposer owner={owner} recordId={recordId} onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
