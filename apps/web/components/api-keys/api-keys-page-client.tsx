"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ROLES } from "@growspark/shared";
import { useMe } from "@/hooks/use-me";
import { useApiKeysList, API_KEYS_QUERY_KEY_ROOT } from "@/hooks/use-api-keys";
import { apiPost } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { CreateApiKeyDialog } from "@/components/api-keys/create-api-key-dialog";
import { RotateApiKeyDialog } from "@/components/api-keys/rotate-api-key-dialog";
import { formatDate } from "@/lib/format";

export function ApiKeysPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: meData, isLoading: meLoading } = useMe();
  const me = meData?.data;

  // The real control is the API (every api-keys route requires
  // settings:manage, which Staff doesn't have) — this redirect is only so
  // Staff don't see a broken page if they land here directly. Same pattern
  // as UsersPageClient.
  useEffect(() => {
    if (!meLoading && me && me.user.role !== ROLES.ADMIN) {
      router.replace("/forbidden");
    }
  }, [meLoading, me, router]);

  const listQuery = useApiKeysList({ page: 1, pageSize: 100 });

  if (meLoading || !me || me.user.role !== ROLES.ADMIN) {
    return null;
  }

  const apiKeys = listQuery.data?.data ?? [];

  async function handleRevoke(id: string) {
    await apiPost(`/api/v1/api-keys/${id}/revoke`);
    toast.success("API key revoked.");
    void queryClient.invalidateQueries({ queryKey: [API_KEYS_QUERY_KEY_ROOT] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateApiKeyDialog />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listQuery.isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {!listQuery.isLoading && apiKeys.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No API keys yet. Create one for the website intake integration.
              </TableCell>
            </TableRow>
          )}
          {apiKeys.map((apiKey) => (
            <TableRow key={apiKey.id}>
              <TableCell>{apiKey.name}</TableCell>
              <TableCell className="font-mono text-sm text-ink-muted">{apiKey.keyPrefix}…</TableCell>
              <TableCell>
                <Badge variant={apiKey.revokedAt ? "danger" : "success"}>
                  {apiKey.revokedAt ? "Revoked" : "Active"}
                </Badge>
              </TableCell>
              <TableCell className="text-ink-muted">
                {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "Never"}
              </TableCell>
              <TableCell className="text-ink-muted">{formatDate(apiKey.createdAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {!apiKey.revokedAt && (
                    <>
                      <RotateApiKeyDialog apiKey={apiKey} />
                      <ConfirmActionDialog
                        triggerLabel="Revoke"
                        title="Revoke API key"
                        description={`${apiKey.name} will stop working on its very next request. This cannot be undone.`}
                        confirmLabel="Revoke"
                        destructive
                        onConfirm={() => handleRevoke(apiKey.id)}
                      />
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
