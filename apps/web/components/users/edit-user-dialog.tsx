"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateUserSchema, ROLES, type UpdateUserInput, type UserResponse } from "@growspark/shared";
import { apiPatch } from "@/lib/api-client";
import { handleApiFormError } from "@/lib/handle-form-error";
import { USERS_QUERY_KEY_ROOT } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function EditUserDialog({ user }: { user: UserResponse }) {
  const [open, setOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { name: user.name, role: user.role },
  });

  const mutation = useMutation({
    mutationFn: (values: UpdateUserInput) =>
      apiPatch<{ data: UserResponse }>(`/api/v1/users/${user.id}`, values),
    onSuccess: (result) => {
      toast.success(`${result.data.name} was updated.`);
      void queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY_ROOT] });
      setOpen(false);
    },
    onError: (error) => {
      setBannerError(handleApiFormError(error, form));
    },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setBannerError(null);
      form.reset({ name: user.name, role: user.role });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => {
              setBannerError(null);
              mutation.mutate(values);
            })}
            className="space-y-4"
          >
            {bannerError && (
              <Alert variant="destructive">
                <AlertDescription>{bannerError}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
                      <SelectItem value={ROLES.STAFF}>Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
