import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Per docs/design-system/README.md §3: only weights 400/500/600 (Inter) and
// 400/500 (JetBrains Mono) — matches the design system's own Google Fonts
// link exactly, loaded here through next/font instead (self-hosted, no
// runtime request to fonts.googleapis.com).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Grow Spark Sales & CRM",
  description: "Internal sales and CRM tool for Grow Spark Consulting",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes sets data-theme (and a style
    // attribute for color-scheme) on this element after hydration, which
    // otherwise mismatches the server-rendered markup — see docs/decisions.md.
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
