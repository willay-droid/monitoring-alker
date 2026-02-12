// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16: ini BUKAN di experimental
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://192.168.1.5:3000",
    "http://192.168.1.8:3000",
    "http://192.168.1.9:3000",
    "http://192.168.1.10:3000",
    "http://192.168.1.12:3000",
    "http://192.168.1.23:3000",
  ],
};

export default nextConfig;
