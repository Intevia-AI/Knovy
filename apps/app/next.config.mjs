/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  output: "export",
  images: {
    unoptimized: true,
  },
  webpack: config => {
    if (!config.module) {
      return config;
    }
    config.module.rules?.push({
      test: /src\/app\/api/,
      loader: 'ignore-loader',
    });
    return config;
  },
};

export default nextConfig;
