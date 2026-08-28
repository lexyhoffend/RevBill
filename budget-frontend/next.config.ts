import type { NextConfig } from "next";

// In production the backend lives on a different domain (Render) than the
// frontend (Vercel). Rewriting /api/* through to it makes every request look
// same-origin to the browser, so the session cookie is a normal first-party
// cookie -- not a cross-site one that Safari (and increasingly other
// browsers) silently blocks or drops. Falls back to the local backend so
// this is a no-op in dev, where everything already runs on localhost.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
