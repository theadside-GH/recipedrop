import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // These packages don't bundle cleanly (WASM / native-ish / large DOM libs);
  // keep them external so they run from node_modules at runtime on the server.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "jsdom",
    "@mozilla/readability",
  ],
};

export default nextConfig;
