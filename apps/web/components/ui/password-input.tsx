"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

export type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">;

/**
 * A password field with a show/hide toggle (Lucide Eye/EyeOff). Thin wrapper
 * around the existing Input, same styling, so it drops into any form
 * (react-hook-form's {...field} spread included) exactly where a plain
 * <Input type="password" /> was used before. Used by login, Create user and
 * Reset password; reuse this rather than a bare password Input elsewhere.
 */
function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-9", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-muted hover:text-ink"
      >
        {visible ? (
          <EyeOff className="size-(--icon-md)" aria-hidden="true" />
        ) : (
          <Eye className="size-(--icon-md)" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
