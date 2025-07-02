const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/music-api/:path*",
        destination:
          (process.env.BACKEND_API_URL || "http://localhost:18880") + "/:path*", // 直接代理到后端，避免路径重复
      },
    ];
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
      {
        protocol: "http",
        hostname: "y.gtimg.cn",
      },
      {
        protocol: "http",
        hostname: "qpic.y.qq.com",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 通过将此大型json文件别名设置为false，可以防止它被打包到客户端，从而显著减小打包体积。
      // 这个json文件是mime-db包的一部分，主要在服务器端使用，客户端并不需要。
      Object.assign(config.resolve.alias, {
        "mime-db/db.json": false,
      });
    }
    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
