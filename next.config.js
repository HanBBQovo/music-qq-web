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
  experimental: {
    esmExternals: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.qqmusic.qq.com",
      },
      {
        protocol: "https",
        hostname: "**.p2.music.126.net",
      },
      {
        protocol: "https",
        hostname: "**.music.126.net",
      },
      {
        protocol: "https",
        hostname: "**.y.qq.com",
      },
      {
        protocol: "https",
        hostname: "**.qlogo.cn",
      },
      {
        protocol: "https",
        hostname: "**.gtimg.cn",
      },
    ],
  },
};

module.exports = nextConfig;
