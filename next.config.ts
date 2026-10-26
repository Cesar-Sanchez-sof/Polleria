import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  // El login vive en app/security/login pero se publica en /login.
  async redirects() {
    return [{ source: "/security/login", destination: "/login", permanent: false }];
  },
  async rewrites() {
    return [{ source: "/login", destination: "/security/login" }];
  },
};

export default nextConfig;
