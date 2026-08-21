import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@basketmatch/domain", "@basketmatch/pricing-engine"],
};

export default nextConfig;
