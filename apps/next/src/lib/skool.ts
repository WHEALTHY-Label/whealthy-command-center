import { getPublicEnv } from '@/lib/env';

export interface SkoolMatch {
  handle: string;
  name: string;
  avatar_url?: string;
}

/**
 * Pre-auth typeahead against the Stewards roster (skool-member-search).
 * Public profile fields only (name/handle/avatar) — no email, no membership
 * or billing. Min 2 chars; the endpoint is rate-limited and returns up to 8.
 *
 * This is a convenience for locating yourself, NOT the access gate. A private
 * Skool profile can be absent here yet still be a real member, so "no match"
 * never blocks sign-in. The real gate is the email (onboarding-state).
 */
export async function searchSkoolMembers(q: string, signal?: AbortSignal): Promise<SkoolMatch[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const env = getPublicEnv();
  const res = await fetch(`${env.NEXT_PUBLIC_FN_BASE}/skool-member-search`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ q: query }),
    signal,
  });
  if (!res.ok) {
    // 429 (rate limit) or any error: treat as no results, never block.
    return [];
  }
  const data = (await res.json()) as { results?: unknown };
  if (!Array.isArray(data.results)) return [];
  return data.results
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({
      handle: String(r.handle ?? ''),
      name: String(r.name ?? r.handle ?? ''),
      avatar_url: typeof r.avatar_url === 'string' ? r.avatar_url : undefined,
    }))
    .filter((m) => m.handle.length > 0);
}
