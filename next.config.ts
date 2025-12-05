import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js-specific modules from client bundle
      config.externals.push('pino', 'pino-pretty', 'thread-stream');

      // Add fallbacks for Node.js modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
        worker_threads: false,
      };
    }
    return config;
  },
};

export default nextConfig;
