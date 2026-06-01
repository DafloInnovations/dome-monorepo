/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@dome/types", "@dome/utils", "@dome/api-client"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
    ],
  },
};

module.exports = nextConfig;
