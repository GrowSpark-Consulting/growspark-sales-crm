import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ROLES,
  type OrganizationResponse,
  type SettingsLeadSourceResponse,
  type SettingsPipelineStageResponse,
} from "@growspark/shared";
import { apiGet } from "@/lib/api-client";
import { useMe } from "@/hooks/use-me";
import { PIPELINE_QUERY_KEY_ROOT } from "@/hooks/use-pipeline";

export const SETTINGS_QUERY_KEY_ROOT = "settings";

/** Admin-only settings data (settings:manage); Staff never call these. */
export function useOrganizationSettings(enabled: boolean) {
  return useQuery({
    queryKey: [SETTINGS_QUERY_KEY_ROOT, "organization"],
    queryFn: () => apiGet<{ data: OrganizationResponse }>("/api/v1/settings/organization"),
    enabled,
  });
}

export function useLeadSourceSettings(enabled: boolean) {
  return useQuery({
    queryKey: [SETTINGS_QUERY_KEY_ROOT, "lead-sources"],
    queryFn: () => apiGet<{ data: SettingsLeadSourceResponse[] }>("/api/v1/settings/lead-sources"),
    enabled,
  });
}

export function usePipelineStageSettings(enabled: boolean) {
  return useQuery({
    queryKey: [SETTINGS_QUERY_KEY_ROOT, "pipeline-stages"],
    queryFn: () => apiGet<{ data: SettingsPipelineStageResponse[] }>("/api/v1/settings/pipeline-stages"),
    enabled,
  });
}

/**
 * After any lead-source change: the settings list and every dropdown that
 * reads GET /lead-sources. After any stage change: the settings list plus
 * the pipeline stages/summary the Deals board and forms read.
 */
export function useInvalidateSettings() {
  const queryClient = useQueryClient();
  return {
    leadSources: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY_ROOT, "lead-sources"] }),
        queryClient.invalidateQueries({ queryKey: ["lead-sources"] }),
      ]),
    stages: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY_ROOT, "pipeline-stages"] }),
        queryClient.invalidateQueries({ queryKey: [PIPELINE_QUERY_KEY_ROOT] }),
      ]),
  };
}

/**
 * Sends Staff to /forbidden if they open an Admin settings page directly.
 * Only a convenience: the real control is every /settings/* API route
 * requiring settings:manage. Returns true once the viewer is a known Admin.
 */
export function useRequireAdmin(): boolean {
  const router = useRouter();
  const { data, isLoading } = useMe();
  const me = data?.data;
  const isAdmin = me?.user.role === ROLES.ADMIN;
  useEffect(() => {
    if (!isLoading && me && !isAdmin) router.replace("/forbidden");
  }, [isLoading, me, isAdmin, router]);
  return !isLoading && isAdmin;
}
