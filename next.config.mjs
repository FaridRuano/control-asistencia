import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/modules/planning/:path*",
        destination: "/dashboard/:path*",
      },
      {
        source: "/modules/company/:path*",
        destination: "/company/:path*",
      },
    ];
  },
};

export default nextConfig;
