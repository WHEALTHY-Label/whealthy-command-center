'use server';

import { revalidatePath } from 'next/cache';
import { memberFn } from '@/lib/fn';
import { deriveFastView } from '@/lib/fastview';

const GENERIC = 'That did not save. Please try again.';

export interface FastActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Every mutation refetches the fast server-side and sends back the SAME
 * object with only the fields this app manages changed. The wizard-era plan
 * fields pass through untouched, so the legacy app keeps rendering fasts
 * this app touches.
 */
async function loadRawFast(): Promise<Record<string, unknown> | null> {
  const state = await memberFn('governor-state', { action: 'load' });
  if (!state.ok) return null;
  const fast = state.data.fast;
  return typeof fast === 'object' && fast !== null ? (fast as Record<string, unknown>) : null;
}

/**
 * The history row the next build reads back to size a fast. `model` is the
 * plan name, exactly as the legacy app records it; `fast_model` on the row is
 * an object and would stringify to nothing useful.
 */
function historyRow(fast: Record<string, unknown>, endedDay: number, finished: boolean) {
  const view = deriveFastView(fast, new Date().toISOString().slice(0, 10));
  return {
    model: view.name === 'Your Fast' ? 'Fast' : view.name,
    duration: typeof fast.duration === 'number' ? fast.duration : null,
    ended_day: endedDay,
    finished,
    weak_rule: null,
  };
}

async function endFast(status: 'completed' | 'ended_early'): Promise<FastActionResult> {
  const fast = await loadRawFast();
  if (!fast || fast.id === undefined) return { ok: false, error: GENERIC };
  const view = deriveFastView(fast, new Date().toISOString().slice(0, 10));
  const endedDay =
    status === 'completed' ? (view.duration ?? view.day) : Math.max(1, view.day);
  const call = await memberFn('governor-state', {
    action: 'end_fast',
    fast_id: fast.id,
    status,
    ended_day: endedDay,
    history_row: historyRow(fast, endedDay, status === 'completed'),
  });
  if (!call.ok || call.data.ok === false) return { ok: false, error: GENERIC };
  revalidatePath('/fast');
  revalidatePath('/cohort');
  return { ok: true };
}

export async function completeFast(): Promise<FastActionResult> {
  return endFast('completed');
}

export async function endFastEarly(): Promise<FastActionResult> {
  return endFast('ended_early');
}

/**
 * A revealed plan begins now; everything the wizard built rides along. A start
 * date set in the future is pulled back to today, matching the live app. A
 * past date is preserved, so the day count is not silently reset.
 */
export async function beginRevealedFast(): Promise<FastActionResult> {
  const fast = await loadRawFast();
  if (!fast || fast.status !== 'revealed') return { ok: false, error: GENERIC };
  const today = new Date().toISOString().slice(0, 10);
  const chosen = typeof fast.start_date === 'string' ? fast.start_date : '';
  const startDate = !chosen || chosen > today ? today : chosen;
  const call = await memberFn('governor-state', {
    action: 'save_fast',
    fast: { ...fast, status: 'active', start_date: startDate },
  });
  if (!call.ok || call.data.ok === false) return { ok: false, error: GENERIC };
  revalidatePath('/fast');
  return { ok: true };
}

export async function discardFast(): Promise<FastActionResult> {
  const call = await memberFn('governor-state', { action: 'discard_fast' });
  if (!call.ok || call.data.ok === false) return { ok: false, error: GENERIC };
  revalidatePath('/fast');
  revalidatePath('/cohort');
  return { ok: true };
}

/**
 * "Not During This Fast" on the equip card. The answer belongs to the plan,
 * not to the browser tab it was given in, so it is stamped alongside
 * `report_filed` and rides through `save_fast` with every other plan field
 * untouched. The legacy app ignores the key, which is the intent: it only ever
 * suppresses a card this app draws.
 */
export async function dismissEquipCard(): Promise<FastActionResult> {
  const fast = await loadRawFast();
  if (!fast) return { ok: false, error: GENERIC };
  const plan =
    typeof fast.plan === 'object' && fast.plan !== null
      ? (fast.plan as Record<string, unknown>)
      : {};
  if (plan.equip_dismissed === true) return { ok: true };
  const call = await memberFn('governor-state', {
    action: 'save_fast',
    fast: { ...fast, plan: { ...plan, equip_dismissed: true } },
  });
  if (!call.ok || call.data.ok === false) return { ok: false, error: GENERIC };
  revalidatePath('/fast');
  return { ok: true };
}

/**
 * File the closing report: the words go to the Record (no evening gate,
 * since the fast is closed) and the plan is stamped report_filed.
 */
export async function fileFastReport(rawText: string): Promise<FastActionResult> {
  const text = rawText.trim();
  if (!text) return { ok: false, error: 'Write honestly about what these days showed you.' };
  if (text.length > 8000) return { ok: false, error: 'Keep the report under 8000 characters.' };
  const fast = await loadRawFast();
  if (!fast) return { ok: false, error: GENERIC };

  const save = await memberFn('governor-state', {
    action: 'save_entry',
    entry_date: new Date().toISOString().slice(0, 10),
    text,
    tone: 'mixed',
    fast_id: fast.id ?? null,
    fast_day: null,
    scribe_line: null,
    resurface: null,
    tz_offset_min: 0,
  });
  if (!save.ok || save.data.ok === false) return { ok: false, error: GENERIC };

  const plan =
    typeof fast.plan === 'object' && fast.plan !== null
      ? (fast.plan as Record<string, unknown>)
      : {};
  const stamp = await memberFn('governor-state', {
    action: 'save_fast',
    fast: { ...fast, plan: { ...plan, report_filed: true } },
  });
  if (!stamp.ok || stamp.data.ok === false) return { ok: false, error: GENERIC };
  revalidatePath('/fast');
  revalidatePath('/record');
  return { ok: true };
}
