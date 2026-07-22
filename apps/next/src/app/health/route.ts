import { NextResponse } from 'next/server';

// Always evaluated fresh so the reported time reflects the live instance.
export const dynamic = 'force-dynamic';

/**
 * Build/runtime metadata for parity tooling and uptime checks. Intentionally
 * exposes nothing sensitive: commit SHA, build time, and runtime only.
 */
export function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'whealthy-next',
    slice: 1,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    builtAt: process.env.WHA_BUILD_TIME ?? 'unknown',
    servedAt: new Date().toISOString(),
    node: process.version,
  });
}
