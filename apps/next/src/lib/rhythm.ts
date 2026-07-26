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

export type CueType = 'time' | 'stack';

export interface RhythmSlot {
  id: string;
  title: string;
  domain: string;
  window: TimeWindow;
  cueType: CueType;
  cue?: string;
  ifThen?: string;
  why?: string;
  origin?: 'engine' | 'steward';
  dayMask: number;
  durationMin: number;
  sortOrder: number;
  done: boolean;
  productUnclaimed?: boolean;
  productKey?: string;
}

/** An unpersisted candidate the engine offers for one-tap adding. */
export interface RhythmSuggestion {
  /** Stable client key; suggestions have no row id until they are added. */
  key: string;
  title: string;
  domain: string;
  window: TimeWindow;
  cueType: CueType;
  cue?: string;
  ifThen?: string;
  why?: string;
  dayMask: number;
  durationMin: number;
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
  /** A plan is live. Draft plans are not active. */
  active: boolean;
  /** A draft is waiting for the steward's approval. */
  isDraft: boolean;
  planId: string | null;
  pendingDraftId: string | null;
  slots: RhythmSlot[];
  suggestions: RhythmSuggestion[];
  invite: string | null;
  adherence7: number;
  adherence30: number;
  consistencyDays: number;
  season: Season;
  freshStart: boolean;
  icsToken: string | null;
}

export const EMPTY_STATUS: RhythmStatus = {
  hasQuiz: false,
  active: false,
  isDraft: false,
  planId: null,
  pendingDraftId: null,
  slots: [],
  suggestions: [],
  invite: null,
  adherence7: 0,
  adherence30: 0,
  consistencyDays: 0,
  season: { source: null, canCommit: true, options: [21, 40, 90] },
  freshStart: false,
  icsToken: null,
};

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

function obj(raw: unknown): Record<string, unknown> | null {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

function str(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

function num(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

function toCueType(raw: unknown): CueType {
  return raw === 'stack' ? 'stack' : 'time';
}

function toOrigin(raw: unknown): RhythmSlot['origin'] {
  if (raw === 'steward') return 'steward';
  if (raw === 'engine') return 'engine';
  return undefined;
}

function parseSeason(raw: unknown): Season {
  const s = obj(raw);
  if (!s) return { source: null, canCommit: true, options: [21, 40, 90] };
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

function parseSlots(raw: unknown, unclaimed: Set<string>): RhythmSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => obj(entry))
    .filter((s): s is Record<string, unknown> => s !== null)
    .map((s, i) => {
      const id = typeof s.id === 'string' ? s.id : String(i);
      return {
        id,
        title: String(s.title ?? s.name ?? s.domain ?? 'Anchor'),
        domain: typeof s.domain === 'string' ? s.domain : 'custom',
        window: toWindow(s.time_window),
        cueType: toCueType(s.cue_type),
        cue: str(s.cue_value),
        ifThen: str(s.if_then_text),
        why: str(s.why),
        origin: toOrigin(s.origin),
        dayMask: num(s.day_mask, 127),
        durationMin: num(s.duration_min, 10),
        sortOrder: num(s.sort_order, i),
        done: s.today_status === 'done',
        productUnclaimed: unclaimed.has(id),
        productKey: str(s.product_key),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function parseSuggestions(raw: unknown): RhythmSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => obj(entry))
    .filter((s): s is Record<string, unknown> => s !== null)
    .map((s, i) => ({
      key: str(s.product_key) ?? `${String(s.domain ?? 'custom')}-${String(s.title ?? i)}`,
      title: String(s.title ?? 'Anchor'),
      domain: typeof s.domain === 'string' ? s.domain : 'custom',
      window: toWindow(s.time_window),
      cueType: toCueType(s.cue_type),
      cue: str(s.cue_value),
      ifThen: str(s.if_then_text),
      why: str(s.why),
      dayMask: num(s.day_mask, 127),
      durationMin: num(s.duration_min, 10),
      productKey: str(s.product_key),
    }));
}

/**
 * Map a `rhythm-status` response onto the shape the app renders.
 *
 * The field names here are the deployed function's, not a guess: `active_plan`
 * is a boolean, adherence arrives nested under `adherence.d7`/`.d30`,
 * `fresh_start` is an object whose `show` flag is the real signal, and the
 * unclaimed products come back as their own list keyed by slot id rather than
 * as a flag on each slot. Kept pure so the contract is unit-testable.
 */
export function parseRhythmStatus(raw: unknown): RhythmStatus {
  const data = obj(raw);
  if (!data) return EMPTY_STATUS;

  const unclaimed = new Set(
    (Array.isArray(data.unclaimed_products) ? data.unclaimed_products : [])
      .map((entry) => obj(entry))
      .map((entry) => (entry && typeof entry.slot_id === 'string' ? entry.slot_id : null))
      .filter((id): id is string => id !== null),
  );

  const adherence = obj(data.adherence);
  const freshStart = obj(data.fresh_start);
  const isDraft = data.is_draft === true;
  const planId = str(data.plan_id) ?? null;

  return {
    hasQuiz: data.has_quiz === true,
    active: data.has_plan === true && !isDraft,
    isDraft,
    planId,
    pendingDraftId: str(data.pending_draft_id) ?? str(data.pending_draft) ?? null,
    slots: parseSlots(data.slots, unclaimed),
    suggestions: parseSuggestions(data.suggestions),
    invite: str(data.invite) ?? null,
    adherence7: num(adherence?.d7, num(data.adherence_pct, 0)),
    adherence30: num(adherence?.d30, 0),
    consistencyDays: num(data.consistency_days, 0),
    season: parseSeason(data.season),
    freshStart: freshStart?.show === true,
    icsToken: str(data.ics_token) ?? null,
  };
}

/** The single Rhythm-tab read. Tolerant of shape drift; degrades safely. */
export const fetchRhythmStatus = cache(async (email: string): Promise<RhythmStatus> => {
  const env = getPublicEnv();
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_FN_BASE}/rhythm-status?email=${encodeURIComponent(email)}`,
      { method: 'POST', headers: authedHeaders(), cache: 'no-store' },
    );
    if (!res.ok) return EMPTY_STATUS;
    return parseRhythmStatus(await res.json());
  } catch {
    return EMPTY_STATUS;
  }
});
