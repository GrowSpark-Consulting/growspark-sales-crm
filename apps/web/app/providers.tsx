"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { SessionExpiryHandler } from "@/components/session-expiry-handler";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* data-theme, not the "class" default — matches the Grow Spark
          design system (docs/design-system/README.md §2: "Set the theme on
          the root element: <html data-theme="light"> or data-theme="dark">")
          and globals.css's [data-theme="dark"] token overrides. Light/Dark/
          System is offered in the user menu (app-shell.tsx); next-themes
          persists the choice (localStorage) and resolves "system" via
          prefers-color-scheme on its own. */}
      <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
        <SessionExpiryHandler />
        {children}
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
