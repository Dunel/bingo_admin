import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "tesseract.js-core", "sharp"],
  allowedDevOrigins: ["192.168.18.93"],
};

export default nextConfig;
