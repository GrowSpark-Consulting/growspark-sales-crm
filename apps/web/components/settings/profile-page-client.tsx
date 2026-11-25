"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { changePasswordSchema, ROLES } from "@growspark/shared";
import { useMe } from "@/hooks/use-me";
import { apiPost } from "@/lib/api-client";
import { handleApiFormError } from "@/lib/handle-form-error";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// The API's schema plus a "type it again" field that only exists on screen;
// only currentPassword and newPassword are ever sent.
const changePasswordFormSchema = changePasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two new passwords do not match",
  });
type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;

const EMPTY: ChangePasswordFormValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

/** /settings/profile — both roles. Name, email and role are changed by an Admin on the Users page. */
export function ProfilePageClient() {
  const { data, isLoading } = useMe();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: EMPTY,
  });

  if (isLoading || !data) return <Skeleton className="h-40 w-full max-w-xl" />;
  const user = data.data.user;

  async function onSubmit(values: ChangePasswordFormValues) {
    setBannerError(null);
    setSubmitting(true);
    try {
      await apiPost("/api/v1/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      form.reset(EMPTY);
      toast.success("Password changed. You have been signed out everywhere else.");
    } catch (error) {
      setBannerError(handleApiFormError(error, form));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
        <h2 className="h3">Your details</h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Fact label="Name" value={user.name} />
          <Fact label="Email" value={user.email} />
          <Fact label="Role" value={user.role === ROLES.ADMIN ? "Admin" : "Staff Executive"} />
        </dl>
        <p className="text-sm text-ink-muted">To change your name, email or role, ask an Admin (Users page).</p>
      </section>

      <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
        <h2 className="h3">Change password</h2>
        <p className="text-sm text-ink-muted">
          You stay signed in here; every other browser or device you are signed in on is signed out.
        </p>
        {bannerError && (
          <Alert variant="destructive">
            <AlertDescription>{bannerError}</AlertDescription>
          </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <p className="text-sm text-ink-muted">At least 10 characters.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password again</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? "Changing…" : "Change password"}
            </Button>
          </form>
        </Form>
      </section>
    </div>
  );
}
