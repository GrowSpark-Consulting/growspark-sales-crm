"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { activityTypeSchema, createActivitySchema, type ActivityType } from "@growspark/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OwnerSelect } from "@/components/pickers/owner-select";
import { apiPost, ApiError } from "@/lib/api-client";
import { fromDatetimeLocalValue } from "@/lib/datetime-local";
import { useMe } from "@/hooks/use-me";
import { ACTIVITIES_QUERY_KEY_ROOT, TIMELINE_QUERY_KEY_ROOT, type TimelineOwner } from "@/hooks/use-activities";

const activityTypes: { value: ActivityType; label: string }[] = [
  { value: "TASK", label: "Task" }, { value: "CALL", label: "Call" },
  { value: "MEETING", label: "Meeting" }, { value: "NOTE", label: "Note" },
];
const priorities = ["LOW", "MEDIUM", "HIGH"] as const;
const ownerField: Record<TimelineOwner, "leadId" | "contactId" | "companyId" | "dealId"> = {
  leads: "leadId", contacts: "contactId", companies: "companyId", deals: "dealId",
};

export function ActivityComposer({ owner, recordId, onCreated }: { owner: TimelineOwner; recordId: string; onCreated?: () => void }) {
  const queryClient = useQueryClient();
  const me = useMe().data?.data.user.id;
  const [type, setType] = useState<ActivityType>("TASK");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [priority, setPriority] = useState<(typeof priorities)[number]>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseType(value: string) {
    const parsed = activityTypeSchema.safeParse(value);
    if (parsed.success) setType(parsed.data);
  }

  function handleTypeKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const nextIndex = event.key === "ArrowRight" ? (index + 1) % activityTypes.length
      : event.key === "ArrowLeft" ? (index + activityTypes.length - 1) % activityTypes.length
        : event.key === "Home" ? 0 : event.key === "End" ? activityTypes.length - 1 : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextType = activityTypes[nextIndex]!;
    chooseType(nextType.value);
    document.getElementById(`activity-type-${recordId}-${nextType.value}`)?.focus();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const body = {
      type, subject, description: description || undefined, priority,
      ...(type === "TASK" || type === "CALL" ? { dueAt: fromDatetimeLocalValue(dueAt) } : {}),
      ...(type === "MEETING" ? { startAt: fromDatetimeLocalValue(startAt), endAt: fromDatetimeLocalValue(endAt) } : {}),
      assigneeId: assigneeId || me || undefined,
      [ownerField[owner]]: recordId,
    };
    const parsed = createActivitySchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the activity details.");
      return;
    }
    setPending(true);
    try {
      await apiPost("/api/v1/activities", parsed.data);
      await queryClient.invalidateQueries({ queryKey: [TIMELINE_QUERY_KEY_ROOT, owner, recordId] });
      await queryClient.invalidateQueries({ queryKey: [ACTIVITIES_QUERY_KEY_ROOT] });
      await queryClient.invalidateQueries({ queryKey: ["today"] });
      if (owner === "leads") await queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (owner === "deals") await queryClient.invalidateQueries({ queryKey: ["deals"] });
      setSubject(""); setDescription(""); setDueAt(""); setStartAt(""); setEndAt(""); setPriority("MEDIUM"); setAssigneeId("");
      onCreated?.();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not save this activity. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-line bg-surface p-4">
      <div>
        <h3 className="h3 mb-3">Add activity</h3>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Activity type">
          {activityTypes.map((item, index) => <Button
            key={item.value} id={`activity-type-${recordId}-${item.value}`} type="button" size="sm"
            variant={type === item.value ? "default" : "outline"} role="tab" aria-selected={type === item.value}
            aria-controls={`activity-panel-${recordId}`} tabIndex={type === item.value ? 0 : -1}
            onClick={() => chooseType(item.value)} onKeyDown={(event) => handleTypeKeyDown(event, index)}
          >{item.label}</Button>)}
        </div>
        <div id={`activity-panel-${recordId}`} role="tabpanel" aria-labelledby={`activity-type-${recordId}-${type}`} tabIndex={0} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`activity-subject-${recordId}`}>Subject *</Label>
        <Input id={`activity-subject-${recordId}`} required maxLength={300} value={subject} onChange={(event) => setSubject(event.target.value)} />
      </div>
      {(type === "TASK" || type === "CALL") && <div className="space-y-2">
        <Label htmlFor={`activity-due-${recordId}`}>Due date and time</Label>
        <Input id={`activity-due-${recordId}`} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
      </div>}
      {type === "MEETING" && <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor={`activity-start-${recordId}`}>Start date and time</Label><Input id={`activity-start-${recordId}`} type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor={`activity-end-${recordId}`}>End date and time</Label><Input id={`activity-end-${recordId}`} type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} /></div>
      </div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor={`activity-priority-${recordId}`}>Priority</Label>
          <Select value={priority} onValueChange={(value) => setPriority(value as (typeof priorities)[number])}><SelectTrigger id={`activity-priority-${recordId}`}><SelectValue /></SelectTrigger><SelectContent>{priorities.map((item) => <SelectItem key={item} value={item}>{item[0]}{item.slice(1).toLowerCase()}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-2"><Label>Assignee</Label><OwnerSelect aria-label="Assignee" value={assigneeId || me} onValueChange={(value) => setAssigneeId(value ?? "")} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor={`activity-description-${recordId}`}>Description</Label><Textarea id={`activity-description-${recordId}`} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        </div>
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : type === "NOTE" ? "Save note" : "Save activity"}</Button>
    </form>
  );
}
