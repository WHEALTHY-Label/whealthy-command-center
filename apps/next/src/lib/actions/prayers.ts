'use server';

import { memberFn, getMemberContext } from '@/lib/fn';
import { getPublicEnv } from '@/lib/env';
import { parseLedger, type LedgerItem } from '@/lib/prayers';

const GENERIC = 'That did not save. Please try again.';

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
}

/**
 * Hand a weight over. Private keeps it in the ledger only; shared also
 * places it on the Prayer Wall (wall-post links the prayer, then the
 * idempotent lift covers the link if the post call raced).
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

  if (share && prayerId) {
    const ctx = await getMemberContext();
    if (ctx) {
      const env = getPublicEnv();
      try {
        await fetch(`${env.NEXT_PUBLIC_FN_BASE}/wall-post`, {
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
      } catch {
        // The prayer is saved either way; the lift below is the second chance.
      }
    }
    await memberFn('prayers-write', { action: 'lift', id: prayerId, display_mode: share.mode });
  }

  return { ok: true, prayerId: prayerId ?? undefined };
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
