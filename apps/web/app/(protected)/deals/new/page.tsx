import { CreateDealPageClient } from "@/components/deals/create-deal-page-client";

// Thin Server Component wrapper (D31, PROJECT-STATE §12).
export const instant = false;

export default function NewDealPage() {
  return <CreateDealPageClient />;
}
