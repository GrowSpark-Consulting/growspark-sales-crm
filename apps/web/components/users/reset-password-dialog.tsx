"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { resetUserPasswordSchema, type ResetUserPasswordInput, type UserResponse } from "@growspark/shared";
import { apiPost } from "@/lib/api-client";
import { handleApiFormError } from "@/lib/handle-form-error";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ResetPasswordDialog({ user }: { user: UserResponse }) {
  const [open, setOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const form = useForm<ResetUserPasswordInput>({
    resolver: zodResolver(resetUserPasswordSchema),
    defaultValues: { newPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ResetUserPasswordInput) =>
      apiPost<void>(`/api/v1/users/${user.id}/reset-password`, values),
    onSuccess: () => {
      toast.success(`${user.name}'s password was reset. They have been signed out everywhere.`);
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
      form.reset({ newPassword: "" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Reset password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Sets a new password for {user.name} and signs them out of every existing session.
          </DialogDescription>
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
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Resetting…" : "Reset password"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
