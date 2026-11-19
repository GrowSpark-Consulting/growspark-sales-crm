import { CreateCompanyPageClient } from "@/components/companies/create-company-page-client";

// Thin Server Component wrapper (D31, PROJECT-STATE §12).
export const instant = false;

export default function NewCompanyPage() {
  return <CreateCompanyPageClient />;
}
