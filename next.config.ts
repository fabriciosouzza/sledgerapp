import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // The basics; HSTS comes from the host. No CSP: Next's inline scripts would need nonces.
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    // The month screen was /month until 2026-09-13 and /review until 2026-09-18; it is the home now.
    return [
      { source: "/month", destination: "/", permanent: true },
      { source: "/review", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
