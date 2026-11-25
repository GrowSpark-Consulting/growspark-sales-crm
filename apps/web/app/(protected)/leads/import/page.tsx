import { ImportWizard } from "@/components/imports/import-wizard";

// Thin Server Component wrapper — see users/page.tsx for why `instant` is
// pinned to false here (D31 / PROJECT-STATE §12).
export const instant = false;

export default function ImportLeadsPage() {
  return <ImportWizard entity="leads" />;
}
