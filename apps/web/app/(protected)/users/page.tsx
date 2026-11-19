"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ROLES } from "@growspark/shared";
import { useMe } from "@/hooks/use-me";
import { useUsersList, USERS_QUERY_KEY_ROOT } from "@/hooks/use-users";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateUserDialog } from "@/components/users/create-user-dialog";
import { EditUserDialog } from "@/components/users/edit-user-dialog";
import { ResetPasswordDialog } from "@/components/users/reset-password-dialog";
import { ConfirmActionDialog } from "@/components/users/confirm-action-dialog";

const PAGE_SIZE = 10;
const ANY = "ANY";

export default function UsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: meData, isLoading: meLoading } = useMe();
  const me = meData?.data;

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>(ANY);
  const [status, setStatus] = useState<string>(ANY);

  // The real control is the API (every users:* route requires users:manage,
  // which Staff doesn't have) — this redirect is only so Staff don't see a
  // broken page if they land here directly.
  useEffect(() => {
    if (!meLoading && me && me.user.role !== ROLES.ADMIN) {
      router.replace("/forbidden");
    }
  }, [meLoading, me, router]);

  const listQuery = useUsersList({
    page,
    pageSize: PAGE_SIZE,
    q: q || undefined,
    role: role === ANY ? undefined : (role as ROLES),
    isActive: status === ANY ? undefined : status === "active",
  });

  if (meLoading || !me || me.user.role !== ROLES.ADMIN) {
    return null;
  }

  const users = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  async function handleDeactivate(userId: string) {
    await apiPost(`/api/v1/users/${userId}/deactivate`);
    toast.success("User deactivated.");
    void queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY_ROOT] });
  }

  async function handleReactivate(userId: string) {
    await apiPost(`/api/v1/users/${userId}/reactivate`);
    toast.success("User reactivated.");
    void queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY_ROOT] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateUserDialog />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={searchInput}
          onValueChange={setSearchInput}
          onSearch={(value) => {
            setPage(1);
            setQ(value);
          }}
          placeholder="Search name or email"
          aria-label="Search users by name or email"
          className="w-64"
        />
        <Select
          value={role}
          onValueChange={(value) => {
            setRole(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All roles</SelectItem>
            <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
            <SelectItem value={ROLES.STAFF}>Staff</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listQuery.isLoading && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {!listQuery.isLoading && users.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No users match these filters.
              </TableCell>
            </TableRow>
          )}
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>
                <Badge variant={user.isActive ? "success" : "default"}>
                  {user.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <EditUserDialog user={user} />
                  <ResetPasswordDialog user={user} />
                  {user.isActive ? (
                    <ConfirmActionDialog
                      triggerLabel="Deactivate"
                      title="Deactivate user"
                      description={`${user.name} will no longer be able to sign in, and all of their active sessions will end immediately.`}
                      confirmLabel="Deactivate"
                      destructive
                      onConfirm={() => handleDeactivate(user.id)}
                    />
                  ) : (
                    <ConfirmActionDialog
                      triggerLabel="Reactivate"
                      title="Reactivate user"
                      description={`${user.name} will be able to sign in again.`}
                      confirmLabel="Reactivate"
                      onConfirm={() => handleReactivate(user.id)}
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {meta && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {meta.page} of {totalPages} ({meta.total} total)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
