import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/admin",
  output: "standalone",
  experimental: {
    // медиа CMS: до 10 МБ на файл (+ multipart overhead)
    proxyClientMaxBodySize: "12mb",
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
