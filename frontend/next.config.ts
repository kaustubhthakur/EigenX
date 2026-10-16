
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,

  allowedDevOrigins: ["192.168.0.101"],

  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
