"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { loginSchema, type LoginInput, type MeResponse } from "@growspark/shared";
import { apiPost, ApiError } from "@/lib/api-client";
import { useMe, ME_QUERY_KEY } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: me, isLoading: meLoading } = useMe();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const next = searchParams.get("next");
  const destination = next && next.startsWith("/") ? next : "/";

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Signed-in users visiting /login go home, not to `next` — `next` only
  // matters for the unauthenticated redirect that brought them here.
  useEffect(() => {
    if (!meLoading && me) {
      router.replace("/");
    }
  }, [meLoading, me, router]);

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      const result = await apiPost<{ data: MeResponse }>("/api/v1/auth/login", values);
      queryClient.setQueryData(ME_QUERY_KEY, result);
      router.replace(destination);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.status === 429 ? "Too many attempts. Try again later." : err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (meLoading || me) {
    // Either still checking, or about to redirect home via the effect above.
    return null;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" className="h-(--control-lg) text-base" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" className="h-(--control-lg) text-base" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Form>
  );
}
