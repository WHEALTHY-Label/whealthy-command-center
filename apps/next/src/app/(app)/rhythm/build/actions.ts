'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthedEmail } from '@/lib/auth/session';
import { getPublicEnv } from '@/lib/env';
import { SLOT_DOMAINS } from '@/lib/rhythmPlan';

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Set when the steward has no current assessment to build from. */
  needsAssessment?: boolean;
  planId?: string;
}

const GENERIC = 'That did not save. Please try again.';

/**
 * Messages the edge functions raise that the steward should read as-is. Any
 * other failure gets the generic line rather than leaking a server detail.
 */
const KNOWN_ERRORS: Record<string, string> = {
  no_assessment: 'Take the rhythm assessment first, so we have something to build on.',
  no_plan: 'There is no rhythm to change yet. Draft one first.',
  too_many: 'Your rhythm is full. Remove an anchor before adding another.',
  not_found: 'That anchor is no longer in your rhythm.',
  title_required: 'Give the anchor a name.',
};

async function callFn(
  slug: string,
  body: unknown,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; result: ActionResult }> {
  const email = await getAuthedEmail();
  if (!email) return { ok: false, result: { ok: false, error: 'Not signed in.' } };

  const env = getPublicEnv();
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_FN_BASE}/${slug}?email=${encodeURIComponent(email)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store',
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const code = typeof data.error === 'string' ? data.error : '';
      return {
        ok: false,
        result: {
          ok: false,
          error: KNOWN_ERRORS[code] ?? GENERIC,
          needsAssessment: code === 'no_assessment',
        },
      };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, result: { ok: false, error: GENERIC } };
  }
}

function refresh() {
  revalidatePath('/rhythm');
  revalidatePath('/rhythm/build');
}

/**
 * Ask the engine for a draft. This inserts a plan row, so it is only ever
 * called from an explicit tap, never on render.
 */
export async function draftRhythm(): Promise<ActionResult> {
  const call = await callFn('rhythm-build', {});
  if (!call.ok) return call.result;
  refresh();
  return { ok: true, planId: typeof call.data.plan_id === 'string' ? call.data.plan_id : undefined };
}

const slotInput = z.object({
  title: z.string().trim().min(1).max(120),
  domain: z.enum(SLOT_DOMAINS),
  cue_type: z.enum(['time', 'stack']),
  cue_value: z.string().trim().max(160),
  why: z.string().trim().max(240).optional(),
  product_key: z.string().trim().max(60).optional(),
  time_window: z.enum(['morning', 'midday', 'afternoon', 'evening']).optional(),
  if_then_text: z.string().trim().max(240).optional(),
  duration_min: z.number().int().min(1).max(240).optional(),
  day_mask: z.number().int().min(0).max(127).optional(),
});

export async function addSlot(raw: unknown): Promise<ActionResult> {
  const parsed = slotInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Give the anchor a name and a cue.' };

  const call = await callFn('rhythm-slot', { action: 'add', ...parsed.data });
  if (!call.ok) return call.result;
  refresh();
  return { ok: true };
}

export async function updateSlot(slotId: unknown, raw: unknown): Promise<ActionResult> {
  const id = z.string().min(1).safeParse(slotId);
  const parsed = slotInput.partial().safeParse(raw);
  if (!id.success || !parsed.success) return { ok: false, error: 'That change could not be read.' };

  const call = await callFn('rhythm-slot', { action: 'update', slot_id: id.data, ...parsed.data });
  if (!call.ok) return call.result;
  refresh();
  return { ok: true };
}

export async function deleteSlot(slotId: unknown): Promise<ActionResult> {
  const id = z.string().min(1).safeParse(slotId);
  if (!id.success) return { ok: false, error: 'That anchor could not be found.' };

  const call = await callFn('rhythm-slot', { action: 'delete', slot_id: id.data });
  if (!call.ok) return call.result;
  refresh();
  return { ok: true };
}

export async function reorderSlots(rawOrder: unknown): Promise<ActionResult> {
  const order = z.array(z.string().min(1)).min(1).max(64).safeParse(rawOrder);
  if (!order.success) return { ok: false, error: 'That order could not be read.' };

  const call = await callFn('rhythm-slot', { action: 'reorder', order: order.data });
  if (!call.ok) return call.result;
  refresh();
  return { ok: true };
}

/**
 * The approval gate. Nothing else in the app calls `rhythm-activate`: a draft
 * becomes a live rhythm only when the steward taps it themselves.
 */
export async function activatePlan(planId: unknown): Promise<ActionResult> {
  const id = z.string().min(1).safeParse(planId);
  if (!id.success) return { ok: false, error: 'There is no draft to approve.' };

  const call = await callFn('rhythm-activate', { plan_id: id.data });
  if (!call.ok) return call.result;
  refresh();
  return { ok: true, planId: id.data };
}
