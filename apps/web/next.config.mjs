/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // typedRoutes graduated out of experimental in Next 15.x
  typedRoutes: true,
  transpilePackages: ['@octera/shared'],
  // Emit a self-contained server bundle for Docker/container deploys.
  // .next/standalone/ contains everything the runtime needs.
  output: 'standalone',
};

export default nextConfig;
