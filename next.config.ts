import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — keep it external to the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  // Ensure the provider template JSON files ship with the server build.
  outputFileTracingIncludes: {
    "/api/**": ["./lib/providers/templates/**"],
  },
};

export default nextConfig;
