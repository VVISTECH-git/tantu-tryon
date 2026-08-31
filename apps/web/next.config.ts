import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The engine is shipped as TypeScript source so it stays readable and has no
  // build step of its own; Next compiles it along with the app.
  transpilePackages: ["@tantu/engine"],
  experimental: {
    serverActions: {
      // Reference photographs go up as base64 in the request body.
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
