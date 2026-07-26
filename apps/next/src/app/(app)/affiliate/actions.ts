'use server';

import { memberFn, getMemberContext } from '@/lib/fn';
import { extractRefId } from '@/lib/catalog';

export interface RegisterResult {
  ok: boolean;
  refId?: string;
  error?: string;
}

/**
 * Register (or re-register: the function upserts on ref_id) the member's
 * affiliate id from a pasted Skool invite link.
 */
export async function registerAffiliate(rawLink: string): Promise<RegisterResult> {
  const refId = extractRefId(rawLink);
  if (!refId) {
    return { ok: false, error: 'Invalid Skool link. Make sure it contains ?ref=...' };
  }
  const ctx = await getMemberContext();
  if (!ctx) return { ok: false, error: 'Not signed in.' };
  const call = await memberFn('register-affiliate', { name: ctx.name, ref_id: refId });
  if (!call.ok) return { ok: false, error: 'That did not save. Please try again.' };
  return { ok: true, refId };
}
