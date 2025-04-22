/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  output: "export",
  images: {
    unoptimized: true,
  }
};

export default nextConfig;
