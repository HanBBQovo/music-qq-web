/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return [
      {
        source: "/music-api/:path*",
        destination:
          (process.env.BACKEND_API_URL || "http://localhost:18880") + "/:path*", // 直接代理到后端，避免路径重复
      },
    ];
  },
};

module.exports = nextConfig;
