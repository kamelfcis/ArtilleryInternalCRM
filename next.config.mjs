/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    serverComponentsExternalPackages: [
      "@napi-rs/canvas",
      "tesseract.js",
      "@libsql/client",
      "@prisma/adapter-libsql",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "@napi-rs/canvas"];
    }
    return config;
  },
};

export default nextConfig;
