import type { NextConfig } from "next";

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  agentRules: false,
  transpilePackages: ["@growspark/shared"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // D104: the web route /enquiries was renamed /form-submissions (UI only).
  // A permanent redirect keeps old bookmarks and links working, for the list
  // and for any sub-path such as /enquiries/<id>. The API route
  // /api/v1/enquiries is NOT renamed and is not touched by this rule.
  async redirects() {
    return [
      {
        source: "/enquiries/:path*",
        destination: "/form-submissions/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
