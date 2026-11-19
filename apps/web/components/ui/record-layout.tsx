"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface RecordLayoutTab {
  value: string;
  label: string;
  content: React.ReactNode;
}

export interface RecordLayoutProps {
  title: string;
  statusBadge?: React.ReactNode;
  actions?: React.ReactNode;
  /** The key-fields strip under the header — label/value pairs, e.g. Owner, Source, Created. */
  keyFields: { label: string; value: React.ReactNode }[];
  tabs: RecordLayoutTab[];
  defaultTab?: string;
}

/**
 * The shared record-detail shell: a header (title, status badge, actions),
 * a key-fields strip, and tabs for the rest — the consistent layout the
 * PRD (13.2 "Record detail experience") asks for across Leads, Companies,
 * Contacts and (later) Deals.
 */
export function RecordLayout({ title, statusBadge, actions, keyFields, tabs, defaultTab }: RecordLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="h1">{title}</h2>
          {statusBadge}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {keyFields.length > 0 && (
        <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-line bg-surface p-4">
          {keyFields.map((field) => (
            <div key={field.label} className="min-w-32">
              <p className="label text-ink-muted">{field.label}</p>
              <p className="body-strong">{field.value}</p>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue={defaultTab ?? tabs[0]?.value}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
