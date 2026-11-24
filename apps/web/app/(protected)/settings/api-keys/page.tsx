import { ApiKeysPageClient } from "@/components/api-keys/api-keys-page-client";

// Thin Server Component wrapper — see users/page.tsx for why `instant` is
// pinned to false here (D31 / PROJECT-STATE §12).
export const instant = false;

export default function ApiKeysPage() {
  return <ApiKeysPageClient />;
}
