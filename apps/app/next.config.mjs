/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // <-- Add this line for static export
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ["@workspace/ui"],
  // Optional: Add basePath if your Electron app loads from a subdirectory
  // basePath: '/app-build',

  // Optional: Disable image optimization if using next export with default loader
  images: {
    unoptimized: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  // Ensure webpack configuration is compatible if needed
  webpack: (config, { isServer }) => {
    // Important: return the modified config
    return config;
  },
};

export default nextConfig;
