/** @type {import('next').NextConfig} */
// A large part of the app (chat export/print, notifications, evidence
// search, SOP library, compliance, audit, etc.) calls relative `/api/...`
// paths directly rather than going through lib/api.ts's NEXT_PUBLIC_API_URL
// base - those requests only work in production because of this rewrite.
// BACKEND_URL is a server-side-only env var (deliberately not NEXT_PUBLIC_ -
// this rewrite runs in the Next.js server/edge layer, not the browser) that
// must point at the deployed FastAPI backend's public URL when the frontend
// and backend are deployed separately (e.g. Vercel + Render). Left unset,
// it falls back to localhost:8000 for local development only.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: "/cds-services/:path*",
        destination: `${BACKEND_URL}/cds-services/:path*`,
      },
    ]
  },
  images: {
    remotePatterns: [],
  },
}

module.exports = nextConfig
