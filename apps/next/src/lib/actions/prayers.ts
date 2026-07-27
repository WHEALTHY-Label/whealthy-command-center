'use server';

import { memberFn, getMemberContext } from '@/lib/fn';
import { getPublicEnv } from '@/lib/env';
import { parseLedger, type LedgerItem } from '@/lib/prayers';

const GENERIC = 'That did not save. Please try again.';
const PRIVATE_ONLY =
  'Saved privately to My Prayers. It could not be placed on the wall just now. You can lift it there from your ledger.';

const CATEGORIES = new Set([
  'household',
  'soul',
  'provision',
  'brothers',
  'unaware',
  'family',
  'work',
  'money',
  'health',
  'head',
  'freeform',
]);

export interface HandoverResult {
  ok: boolean;
  error?: string;
  prayerId?: string;
  /**
   * True only when the weight actually reached the Prayer Wall. Always false
   * for a private handover, and false when a shared one saved to the ledger
   * but the wall post was refused. The confirmation screen reads this instead
   * of assuming the share succeeded.
   */
  shared?: boolean;
  /** Why a shared handover stayed private, in words a steward can act on. */
  notice?: string;
}

/**
 * Hand a weight over. Private keeps it in the ledger only; shared also places
 * it on the Prayer Wall.
 *
 * The wall step is gated on the wall-post response, the way the live app gates
 * it at index.html:11456 (`if (wallRes.status === 200)`). It has to be. The
 * `lift` action in `prayers-write` has no rate limit of its own and inserts
 * `source: 'wall'`, while `wall-post` is the function that enforces the
 * 3-posts-per-24-hours cap (429 at wall-post/index.ts:59) and stores the
 * handover provenance. Running the lift unconditionally, as this used to,
 * turned every refused post into a successful one by the back door: the cap
 * was bypassed and the row lost its `prayer_handover` origin.
 */
export async function handOver(
  rawCategory: string,
  rawBody: string,
  share: { mode: 'signed' | 'anonymous' } | null,
): Promise<HandoverResult> {
  const category = CATEGORIES.has(rawCategory) ? rawCategory : 'freeform';
  const body = rawBody.trim();
  if (body.length < 1 || body.length > 1000) {
    return { ok: false, error: 'Name it in one simple line, under 1000 characters.' };
  }

  const created = await memberFn('prayers-write', {
    action: 'create',
    kind: 'handover',
    category,
    body,
  });
  if (!created.ok) return { ok: false, error: GENERIC };
  const prayerId = created.data.id === undefined ? null : String(created.data.id);

  if (!share || !prayerId) {
    return { ok: true, prayerId: prayerId ?? undefined, shared: false };
  }

  const ctx = await getMemberContext();
  if (!ctx) {
    return { ok: true, prayerId, shared: false, notice: PRIVATE_ONLY };
  }

  const env = getPublicEnv();
  let status = 0;
  let message = '';
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_FN_BASE}/wall-post`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store',
      body: JSON.stringify({
        member_id: ctx.memberId,
        body,
        display_mode: share.mode,
        source: 'prayer_handover',
        prayer_id: prayerId,
      }),
    });
    status = res.status;
    if (status !== 200) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      message = typeof data.error === 'string' ? data.error : '';
    }
  } catch {
    // Network reach, not a refusal. Same outcome either way: it stayed private.
    status = 0;
  }

  if (status !== 200) {
    return {
      ok: true,
      prayerId,
      shared: false,
      notice:
        status === 429
          ? 'Saved privately. The wall takes up to 3 posts per steward every 24 hours, so this one stayed in My Prayers. You can lift it to the wall tomorrow.'
          : message
            ? `Saved privately. It did not reach the wall: ${message}`
            : PRIVATE_ONLY,
    };
  }

  // wall-post already linked the prayer (wall-post/index.ts:82 sets
  // `wall_post_id` where it is still null), so this is the belt to that
  // braces: `lift` returns the prayer untouched when the link is present and
  // only creates a post if the link somehow lost the race.
  await memberFn('prayers-write', { action: 'lift', id: prayerId, display_mode: share.mode });

  return { ok: true, prayerId, shared: true };
}

export async function fetchLedger(): Promise<LedgerItem[]> {
  const call = await memberFn('prayers-read', {});
  if (!call.ok) return [];
  // The default view answers a bare array; memberFn returns parsed JSON
  // which for arrays still lands in data as an object-like value.
  return parseLedger(call.data);
}

export interface AnswerResult {
  ok: boolean;
  error?: string;
}

/** "Did He Answer?" from the ledger: closes the prayer with the story. */
export async function answerLedgerPrayer(
  id: string,
  rawNote: string,
  liftToTestimony: boolean,
): Promise<AnswerResult> {
  const note = rawNote.trim();
  if (note.length < 1 || note.length > 1000) {
    return { ok: false, error: 'Tell the story in under 1000 characters.' };
  }
  const call = await memberFn('prayers-write', {
    action: 'answered',
    id,
    note,
    lift_to_testimony: liftToTestimony,
  });
  if (!call.ok) return { ok: false, error: GENERIC };
  return { ok: true };
}
