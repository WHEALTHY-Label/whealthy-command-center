import { getPublicEnv } from '@/lib/env';

export interface SkoolMatch {
  handle: string;
  name: string;
  avatar_url?: string;
}

/**
 * Normalize the deployed skool-member-search payload into SkoolMatch rows.
 *
 * Pure and defensive: an error body, a missing `results`, or a row without a
 * handle all collapse to "nothing to show" rather than throwing into the
 * typeahead. Kept separate from the fetch so it is node-testable.
 */
export function parseSkoolResults(payload: unknown): SkoolMatch[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const { results } = payload as { results?: unknown };
  if (!Array.isArray(results)) return [];
  return results
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({
      handle: String(r.handle ?? ''),
      name: String(r.name ?? r.handle ?? ''),
      avatar_url: typeof r.avatar_url === 'string' ? r.avatar_url : undefined,
    }))
    .filter((m) => m.handle.length > 0);
}

/**
 * Pre-auth typeahead against the Stewards roster (skool-member-search).
 * Public profile fields only (name/handle/avatar) — no email, no membership
 * or billing. Min 2 chars; the endpoint is rate-limited and returns up to 8.
 *
 * This is a convenience for locating yourself, NOT the access gate. A private
 * Skool profile can be absent here yet still be a real member, so "no match"
 * never blocks sign-in. The real gate is the email (onboarding-state).
 *
 * CORS: this is the one call in the app that leaves the browser for Supabase
 * directly, so it must send ONLY `Content-Type`. The deployed function answers
 * the preflight with `Access-Control-Allow-Headers: Content-Type`, so adding
 * `apikey` or `Authorization` makes the browser refuse the request before it
 * is ever sent. The function is pre-auth by design and reads nothing from
 * those headers. This mirrors the live app's call exactly (index.html:11812).
 *
 * It is deliberately NOT proxied through a same-origin route: the function
 * rate-limits on x-forwarded-for, and a server-side proxy would collapse every
 * steward into one 90-req/minute bucket.
 */
export async function searchSkoolMembers(q: string, signal?: AbortSignal): Promise<SkoolMatch[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const env = getPublicEnv();
  const res = await fetch(`${env.NEXT_PUBLIC_FN_BASE}/skool-member-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query }),
    signal,
  });
  if (!res.ok) {
    // 429 (rate limit) or any error: treat as no results, never block.
    return [];
  }
  return parseSkoolResults(await res.json());
}
