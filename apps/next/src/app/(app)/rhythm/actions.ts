'use server';

import { revalidatePath } from 'next/cache';
import { getAuthedEmail } from '@/lib/auth/session';
import { getPublicEnv } from '@/lib/env';

export interface CheckinResult {
  ok: boolean;
  error?: string;
}

/**
 * Mark today's completion for a slot (done) or undo it (skipped). Identity is
 * the validated session email, never client input; the edge function enforces
 * ownership server-side.
 */
export async function checkInSlot(slotId: string, done: boolean): Promise<CheckinResult> {
  const email = await getAuthedEmail();
  if (!email) return { ok: false, error: 'Not signed in.' };
  if (!slotId) return { ok: false, error: 'Missing slot.' };

  const env = getPublicEnv();
  // Backend day boundaries are UTC (v1); match that for the check date.
  const date = new Date().toISOString().slice(0, 10);

  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_FN_BASE}/rhythm-checkin?email=${encodeURIComponent(email)}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        cache: 'no-store',
        body: JSON.stringify({
          slot_id: slotId,
          date,
          status: done ? 'done' : 'skipped',
          source: 'manual',
        }),
      },
    );
    if (!res.ok) {
      return { ok: false, error: 'That did not save. Please try again.' };
    }
    revalidatePath('/rhythm');
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save. Please try again.' };
  }
}
