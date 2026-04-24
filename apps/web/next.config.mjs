/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // typedRoutes graduated out of experimental in Next 15.x
  typedRoutes: true,
  transpilePackages: ['@octera/shared'],
};

export default nextConfig;
