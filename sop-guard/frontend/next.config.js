/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
      {
        source: "/cds-services/:path*",
        destination: "http://localhost:8000/cds-services/:path*",
      },
    ]
  },
  images: {
    remotePatterns: [],
  },
}

module.exports = nextConfig
