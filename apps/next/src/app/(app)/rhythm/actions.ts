'use server';

import { revalidatePath } from 'next/cache';
import { getAuthedEmail } from '@/lib/auth/session';
import { getPublicEnv } from '@/lib/env';
import { parseNudges, type Nudge } from '@/lib/nudges';
import { isSeasonLength } from '@/lib/season';

export interface CheckinResult {
  ok: boolean;
  error?: string;
}

const GENERIC = 'That did not save. Please try again.';

/**
 * Call an email-gated rhythm function with the validated session email.
 * Members hold no JWT, so identity is the query string the function checks
 * against `approved_members`, never anything the client passed in.
 */
async function callFn(
  slug: string,
  body: unknown,
): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; code: string; status: number }
> {
  const email = await getAuthedEmail();
  if (!email) return { ok: false, code: 'not_signed_in', status: 401 };

  const env = getPublicEnv();
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_FN_BASE}/${slug}?email=${encodeURIComponent(email)}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        cache: 'no-store',
        body: JSON.stringify(body ?? {}),
      },
    );
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        code: typeof data.error === 'string' ? data.error : '',
        status: res.status,
      };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, code: '', status: 0 };
  }
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

  // UTC on purpose, and the one date in this app that is not Chicago. The live
  // app's `Rhythm.toggleCheckin` sends `new Date().toISOString().split('T')[0]`
  // (index.html:20339) and `rhythm-checkin` stores it verbatim, so a Chicago
  // date here would file the same evening's check-in under a different day than
  // the legacy app files it under and the two would disagree in the table.
  // Whenever the rhythm backend moves to Chicago, this moves with it.
  const date = new Date().toISOString().slice(0, 10);

  const call = await callFn('rhythm-checkin', {
    slot_id: slotId,
    date,
    status: done ? 'done' : 'skipped',
    source: 'manual',
  });
  if (!call.ok) return { ok: false, error: GENERIC };

  revalidatePath('/rhythm');
  return { ok: true };
}

export interface SeasonResult {
  ok: boolean;
  error?: string;
}

/**
 * Messages `rhythm-season` raises that the steward should read as-is. Anything
 * else gets a plain line rather than a leaked server detail.
 */
const SEASON_ERRORS: Record<string, string> = {
  no_active_plan: 'Make your rhythm live first, then you can name a season.',
  bad_length: 'Choose 21, 40, or 90 days.',
  unknown_action: GENERIC,
};

/**
 * Commit to a season of a set length. The server re-checks the length against
 * its own allowed list, so this validation mirrors it rather than replacing it,
 * and the day count restarts from today either way.
 */
export async function commitSeason(rawLength: unknown): Promise<SeasonResult> {
  const length = typeof rawLength === 'string' ? Number(rawLength) : rawLength;
  if (!isSeasonLength(length)) return { ok: false, error: 'Choose 21, 40, or 90 days.' };

  const call = await callFn('rhythm-season', { action: 'commit', length_days: length });
  if (!call.ok) return { ok: false, error: SEASON_ERRORS[call.code] ?? GENERIC };

  revalidatePath('/rhythm');
  return { ok: true };
}

/**
 * Close the season out. The anchors stay exactly as they are; only the count
 * stops, which is why nothing here touches the plan's slots.
 */
export async function endSeason(): Promise<SeasonResult> {
  const call = await callFn('rhythm-season', { action: 'end' });
  if (!call.ok) return { ok: false, error: SEASON_ERRORS[call.code] ?? GENERIC };

  revalidatePath('/rhythm');
  return { ok: true };
}

/**
 * Ask for the nudges waiting on this steward.
 *
 * `rhythm-nudge-check` writes a `rhythm_nudges` row for everything it returns
 * and then hides that same kind for eighteen hours. Calling it is therefore
 * spending a nudge, not peeking at one: it belongs to a deliberate check from a
 * mounted page where the copy will actually be read, never to a render path, a
 * prefetch or a poll on an interval.
 */
export async function checkNudges(suppressFreshStart: boolean): Promise<Nudge[]> {
  const call = await callFn('rhythm-nudge-check', {});
  if (!call.ok) return [];
  return parseNudges(call.data, { suppressFreshStart });
}
