/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@dome/ui", "@dome/types", "@dome/utils", "@dome/api-client"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
    ],
  },
};

module.exports = nextConfig;
