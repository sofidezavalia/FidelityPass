import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@fidelitypass/ui",
    "@fidelitypass/contracts",
    "@fidelitypass/db",
  ],
};

export default nextConfig;
