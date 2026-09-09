import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The engine is shipped as TypeScript source so it stays readable and has no
  // build step of its own; Next compiles it along with the app.
  transpilePackages: ["@tantu/engine"],
  images: {
    /*
      SLK's product photographs live in Cloudflare R2 and are served from its
      public bucket host. next/image refuses any remote host that is not named
      here, so without this the lookup page renders four broken frames.

      Narrow on purpose: this host, https only, and only the products prefix
      those photographs are written under.
    */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-344134bc87ed4d1b8a06ac24789cf1da.r2.dev",
        pathname: "/products/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Reference photographs go up as base64 in the request body.
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
