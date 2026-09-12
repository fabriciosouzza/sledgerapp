import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The review screen was /month until 2026-09-13.
    return [{ source: "/month", destination: "/review", permanent: true }];
  },
};

export default nextConfig;
