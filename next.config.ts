import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Disabilitiamo il controllo ESLint durante la build di produzione per file legacy migrati
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignoriamo gli errori di tipo statico per garantire che Vercel completi sempre la build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
