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
    // Tesseract loads companion .wasm files at runtime; Vercel's file tracer
    // omits them unless explicitly included (causes ENOENT + HTML/504 errors).
    outputFileTracingIncludes: {
      "/api/crm/scan": [
        "./node_modules/tesseract.js-core/**/*",
        "./node_modules/tesseract.js/dist/**/*",
        "./node_modules/tesseract.js/src/worker-script/**/*",
      ],
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "@napi-rs/canvas"];
    }
    return config;
  },
};

export default nextConfig;
