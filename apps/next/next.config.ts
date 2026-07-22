import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    // Build metadata surfaced by the /health route for parity tooling.
    WHA_BUILD_TIME: new Date().toISOString(),
    // PUBLIC Supabase config. These are the publishable values that already
    // ship in the live site's browser bundle — safe to commit. The SECRET
    // service-role key is never set here or anywhere client-reachable.
    // Set in config (not a dashboard env var) so the preview is self-contained.
    NEXT_PUBLIC_SUPABASE_URL: 'https://yzaxzmuuvozonhgwhlim.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_IqQKNfeFxD4nnbjOIVRvRw_U7dgqBTN',
    NEXT_PUBLIC_FN_BASE: 'https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1',
  },
  // Migration guardrail: never silently ship broken code. Type errors must
  // fail the build. (Linting runs as its own gate; Next 16 no longer exposes
  // an `eslint` build option.)
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
};

export default nextConfig;
