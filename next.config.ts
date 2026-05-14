import type { NextConfig } from "next";

// Intercetta e stabilizza preventivamente la presenza di polyfill o stub globali di localStorage in ambiente Node/Turbopack
if (typeof window === "undefined") {
  try {
    const dummyStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };
    if (typeof globalThis !== "undefined") {
      Object.defineProperty(globalThis, "localStorage", {
        value: dummyStorage,
        writable: true,
        configurable: true,
      });
    }
  } catch (e) {}
}

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
