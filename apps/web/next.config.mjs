/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ionexflow/ui"],
  experimental: {
    serverActions: {
      // Server Actions used by the login/signup forms.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
