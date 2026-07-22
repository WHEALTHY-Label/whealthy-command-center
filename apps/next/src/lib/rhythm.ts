import { cache } from 'react';
import { getPublicEnv } from '@/lib/env';

export type TimeWindow = 'morning' | 'midday' | 'afternoon' | 'evening' | 'anytime';

const WINDOW_ORDER: TimeWindow[] = ['morning', 'midday', 'afternoon', 'evening', 'anytime'];
const WINDOW_LABELS: Record<TimeWindow, string> = {
  morning: 'Morning',
  midday: 'Midday',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
};

export interface RhythmSlot {
  id: string;
  title: string;
  window: TimeWindow;
  cue?: string;
  ifThen?: string;
  why?: string;
  origin?: 'engine' | 'steward';
  done: boolean;
  productUnclaimed?: boolean;
  productKey?: string;
}

export interface Season {
  source: 'fast' | 'rhythm' | null;
  day?: number;
  total?: number;
  canCommit: boolean;
  options?: number[];
}

export interface RhythmStatus {
  hasQuiz: boolean;
  active: boolean;
  planId: string | null;
  pendingDraftId: string | null;
  slots: RhythmSlot[];
  adherence7: number;
  adherence30: number;
  consistencyDays: number;
  season: Season;
  freshStart: boolean;
  icsToken: string | null;
}

/** Normalize an arbitrary window string to a known TimeWindow. */
export function toWindow(value: unknown): TimeWindow {
  return value === 'morning' || value === 'midday' || value === 'afternoon' || value === 'evening'
    ? value
    : 'anytime';
}

/** Group slots into ordered time-window buckets, dropping empty ones. Pure. */
export function groupByWindow(
  slots: RhythmSlot[],
): Array<{ window: TimeWindow; label: string; slots: RhythmSlot[] }> {
  return WINDOW_ORDER.map((w) => ({
    window: w,
    label: WINDOW_LABELS[w],
    slots: slots.filter((s) => s.window === w),
  })).filter((group) => group.slots.length > 0);
}

/** Today's completion from the slot set. Pure. */
export function dayCompletion(slots: RhythmSlot[]): {
  done: number;
  total: number;
  complete: boolean;
} {
  const total = slots.length;
  const done = slots.filter((s) => s.done).length;
  return { done, total, complete: total > 0 && done === total };
}

/** Format a 0-100 adherence number as a gentle percentage label. Pure. */
export function formatAdherence(pct: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return `${clamped}%`;
}

function authedHeaders() {
  const env = getPublicEnv();
  return {
    'content-type': 'application/json',
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  };
}

function parseSeason(raw: unknown): Season {
  if (typeof raw !== 'object' || raw === null) {
    return { source: null, canCommit: true, options: [21, 40, 90] };
  }
  const s = raw as Record<string, unknown>;
  const source = s.source === 'fast' || s.source === 'rhythm' ? s.source : null;
  return {
    source,
    day: typeof s.day === 'number' ? s.day : undefined,
    total: typeof s.total === 'number' ? s.total : undefined,
    canCommit: s.can_commit !== false,
    options: Array.isArray(s.options)
      ? s.options.filter((n): n is number => typeof n === 'number')
      : [21, 40, 90],
  };
}

function parseSlots(raw: unknown): RhythmSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .map((s, i) => ({
      id: typeof s.id === 'string' ? s.id : String(i),
      title: String(s.title ?? s.name ?? s.domain ?? 'Anchor'),
      window: toWindow(s.time_window),
      cue: typeof s.cue_value === 'string' ? s.cue_value : undefined,
      ifThen: typeof s.if_then_text === 'string' ? s.if_then_text : undefined,
      why: typeof s.why === 'string' ? s.why : undefined,
      origin: s.origin === 'steward' ? 'steward' : s.origin === 'engine' ? 'engine' : undefined,
      done: s.today_status === 'done' || s.done === true,
      productUnclaimed: s.product_unclaimed === true,
      productKey: typeof s.product_key === 'string' ? s.product_key : undefined,
    }));
}

/** The single Rhythm-tab read. Tolerant of shape drift; degrades safely. */
export const fetchRhythmStatus = cache(async (email: string): Promise<RhythmStatus> => {
  const env = getPublicEnv();
  const empty: RhythmStatus = {
    hasQuiz: false,
    active: false,
    planId: null,
    pendingDraftId: null,
    slots: [],
    adherence7: 0,
    adherence30: 0,
    consistencyDays: 0,
    season: { source: null, canCommit: true, options: [21, 40, 90] },
    freshStart: false,
    icsToken: null,
  };
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_FN_BASE}/rhythm-status?email=${encodeURIComponent(email)}`,
      { method: 'POST', headers: authedHeaders(), cache: 'no-store' },
    );
    if (!res.ok) return empty;
    const data = (await res.json()) as Record<string, unknown>;
    const activePlan =
      typeof data.active_plan === 'object' && data.active_plan !== null
        ? (data.active_plan as Record<string, unknown>)
        : null;
    const slotsRaw = activePlan?.slots ?? data.slots;
    return {
      hasQuiz: data.has_quiz === true,
      active: activePlan !== null || Array.isArray(data.slots),
      planId:
        (activePlan && typeof activePlan.id === 'string' && activePlan.id) ||
        (typeof data.plan_id === 'string' && data.plan_id) ||
        null,
      pendingDraftId:
        (typeof data.pending_draft_id === 'string' && data.pending_draft_id) ||
        (typeof data.pending_draft === 'string' && data.pending_draft) ||
        null,
      slots: parseSlots(slotsRaw),
      adherence7: typeof data.adherence_7 === 'number' ? data.adherence_7 : 0,
      adherence30: typeof data.adherence_30 === 'number' ? data.adherence_30 : 0,
      consistencyDays: typeof data.consistency_days === 'number' ? data.consistency_days : 0,
      season: parseSeason(data.season),
      freshStart:
        data.fresh_start === true ||
        (typeof data.fresh_start === 'object' && data.fresh_start !== null),
      icsToken:
        (activePlan && typeof activePlan.ics_token === 'string' && activePlan.ics_token) ||
        (typeof data.ics_token === 'string' && data.ics_token) ||
        null,
    };
  } catch {
    return empty;
  }
});
