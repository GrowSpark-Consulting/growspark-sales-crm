import { CreateLeadPageClient } from "@/components/leads/create-lead-page-client";

// Thin Server Component wrapper (D31, PROJECT-STATE §12).
export const instant = false;

export default function NewLeadPage() {
  return <CreateLeadPageClient />;
}
