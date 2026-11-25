import { SettingsPageClient } from "@/components/settings/settings-page-client";

// Thin Server Component wrapper — see users/page.tsx for why `instant` is
// pinned to false here (D31 / PROJECT-STATE §12).
export const instant = false;

export default function SettingsPage() {
  return <SettingsPageClient />;
}
