'use server';

import { sessionFn } from '@/lib/fn';
import { FS_KEYS, parseTourStateResult } from '@/lib/tour';

export interface TourWriteResult {
  ok: boolean;
  tourDoneAt: string | null;
  firstSteps: Record<string, boolean>;
}

const ALLOWED = new Set<string>(FS_KEYS);

/**
 * Mark a First Step complete.
 *
 * `tour-state` takes its identity from the session JWT, not from the payload,
 * so the caller cannot mark steps for anyone else. The RPC merges with `||`
 * on jsonb, which makes the write idempotent and append-only: a step never
 * un-checks itself.
 *
 * The live app never checked `res.ok` here, so a 401 or a 500 silently lost
 * the member's progress. This one reports the failure back so the caller can
 * leave the local flag unset and retry on the next visit.
 */
export async function reportFirstStep(key: string): Promise<TourWriteResult> {
  if (!ALLOWED.has(key)) return { ok: false, tourDoneAt: null, firstSteps: {} };
  const res = await sessionFn('tour-state', { steps: { [key]: true } });
  if (!res.ok) return { ok: false, tourDoneAt: null, firstSteps: {} };
  const parsed = parseTourStateResult(res.data);
  return { ok: true, ...parsed };
}

/**
 * Record that the guided tour was walked. `tour_done_at` is coalesce-guarded
 * server-side, so the first completion wins and a retake never moves it.
 */
export async function markTourDone(): Promise<TourWriteResult> {
  const res = await sessionFn('tour-state', { done: true });
  if (!res.ok) return { ok: false, tourDoneAt: null, firstSteps: {} };
  const parsed = parseTourStateResult(res.data);
  return { ok: true, ...parsed };
}
