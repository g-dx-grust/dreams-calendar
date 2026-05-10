import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.10.110"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s1-imfile.feishucdn.com" },
      { protocol: "https", hostname: "s3-imfile.feishucdn.com" },
      { protocol: "https", hostname: "p1-lark-avatar.byteimg.com" },
      { protocol: "https", hostname: "**.larksuite.com" },
      { protocol: "https", hostname: "**.feishu.cn" },
    ],
  },
};

export default nextConfig;
