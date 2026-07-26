'use server';

import { revalidatePath } from 'next/cache';
import { memberFn } from '@/lib/fn';

const GENERIC = 'That did not save. Please try again.';

export interface CircleResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export async function createCircle(rawName: string): Promise<CircleResult> {
  const name = rawName.trim().slice(0, 60);
  if (!name) return { ok: false, error: 'Give your circle a name.' };
  const call = await memberFn('circle-create', { name });
  if (!call.ok) return { ok: false, error: call.code || GENERIC };
  revalidatePath('/circle');
  return { ok: true };
}

export async function joinCircle(rawCode: string): Promise<CircleResult> {
  const code = rawCode.trim().toUpperCase();
  if (code.length !== 6) return { ok: false, error: 'Invite codes are 6 characters.' };
  const call = await memberFn('circle-join', { invite_code: code });
  if (!call.ok) return { ok: false, error: call.code || GENERIC };
  revalidatePath('/circle');
  return { ok: true };
}

export async function leaveCircle(circleId: string): Promise<CircleResult> {
  if (!circleId) return { ok: false, error: GENERIC };
  const call = await memberFn('circle-leave', { circle_id: circleId });
  if (!call.ok) return { ok: false, error: call.code || GENERIC };
  revalidatePath('/circle');
  return { ok: true };
}

/**
 * Pray-nudge a circle brother. Three per member per day; the cap answer is a
 * warm line, not an error.
 */
export async function nudgeMember(circleId: string, forMemberId: number): Promise<CircleResult> {
  if (!circleId || !Number.isInteger(forMemberId)) return { ok: false, error: GENERIC };
  const call = await memberFn('circle-nudge', { circle_id: circleId, for_member: forMemberId });
  if (!call.ok) return { ok: false, error: call.code || GENERIC };
  if (call.data.capped === true) {
    return { ok: true, message: 'You have lifted them up all you can today.' };
  }
  revalidatePath('/circle');
  return { ok: true };
}
