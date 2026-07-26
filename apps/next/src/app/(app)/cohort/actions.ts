'use server';

import { revalidatePath } from 'next/cache';
import { memberFn } from '@/lib/fn';
import { postToWall } from '@/lib/actions/wall';

const GENERIC = 'That did not save. Please try again.';

export interface CohortResult {
  ok: boolean;
  error?: string;
}

export async function joinCohort(rawId: string): Promise<CohortResult> {
  const cohortId = rawId.trim();
  if (!cohortId) return { ok: false, error: 'Enter the Cohort ID.' };
  const call = await memberFn('cohort-join', { cohort_id: cohortId });
  if (!call.ok) return { ok: false, error: call.code || GENERIC };
  revalidatePath('/cohort');
  revalidatePath('/fast');
  return { ok: true };
}

/**
 * Post a cohort testimony to the Prayer Wall. The deployed wall-post only
 * accepts sources {bible365, wall, prayer_handover}; the legacy client sent
 * "challenge" and always got a 400, so this uses "wall".
 */
export async function postCohortTestimony(
  body: string,
  mode: 'signed' | 'anonymous',
): Promise<CohortResult> {
  const result = await postToWall(body, mode, 'wall');
  if (!result.ok) return { ok: false, error: result.error ?? GENERIC };
  return { ok: true };
}
