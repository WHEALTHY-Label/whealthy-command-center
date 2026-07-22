import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Build metadata surfaced by the /health route for parity tooling.
  env: {
    WHA_BUILD_TIME: new Date().toISOString(),
  },
  // Migration guardrail: never silently ship broken code. Type errors must
  // fail the build. (Linting runs as its own gate; Next 16 no longer exposes
  // an `eslint` build option.)
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
};

export default nextConfig;
