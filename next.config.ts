import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // PGlite is local-dev only and should run from node_modules on the server.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
