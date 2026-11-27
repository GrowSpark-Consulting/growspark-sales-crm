import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config redirects (D104)", () => {
  it("permanently redirects /enquiries and every sub-path to /form-submissions, and nothing else", async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toEqual([{ source: "/enquiries/:path*", destination: "/form-submissions/:path*", permanent: true }]);
  });

  it("leaves the API route /api/v1/enquiries alone: the redirect source is anchored at the start of the path", async () => {
    const [rule] = (await nextConfig.redirects?.()) ?? [];
    // Next.js anchors `source` to the start of the path (docs: redirects, "Path Matching"),
    // so "/api/v1/enquiries" can never match "/enquiries/:path*".
    expect(rule?.source.startsWith("/enquiries")).toBe(true);
    expect(rule?.source.includes("/api/")).toBe(false);
  });

  it("keeps the API rewrite untouched", async () => {
    const rewrites = await nextConfig.rewrites?.();
    expect(rewrites).toEqual([{ source: "/api/:path*", destination: expect.stringContaining("/api/:path*") }]);
  });
});
