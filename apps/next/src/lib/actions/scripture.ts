'use server';

import { getAuthedEmail } from '@/lib/auth/session';
import { getPublicEnv } from '@/lib/env';
import { parsePassage, type Passage } from '@/lib/bible';

/**
 * Fetch a passage from the owned BSB text. The function itself is public,
 * but this action still requires a session so the app's scripture reader
 * is never an open proxy.
 */
export async function fetchPassage(rawRef: string): Promise<Passage | null> {
  const email = await getAuthedEmail();
  if (!email) return null;
  const ref = rawRef.trim().slice(0, 80);
  if (!ref) return null;
  const env = getPublicEnv();
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_FN_BASE}/bible-verses?ref=${encodeURIComponent(ref)}`,
      {
        headers: {
          apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    return parsePassage(await res.json());
  } catch {
    return null;
  }
}
