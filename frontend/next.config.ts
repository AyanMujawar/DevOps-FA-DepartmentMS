import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a small self-contained server (.next/standalone) so the Docker image
  // does not need the full node_modules folder.
  output: "standalone",
};

export default nextConfig;
