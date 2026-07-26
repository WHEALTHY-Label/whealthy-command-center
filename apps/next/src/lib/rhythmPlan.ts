/**
 * The pure half of the rhythm builder: everything about editing a draft plan
 * that does not need the network. The edge functions stay the authority on
 * what is stored; these helpers only decide what the steward is allowed to
 * ask for and how it reads back to them before they approve it.
 */

import type { CueType, RhythmSlot, RhythmSuggestion, TimeWindow } from '@/lib/rhythm';

/**
 * Soft cap, mirrored from `rhythm-slot`. The server rejects the fifteenth add;
 * we stop offering it first so the steward meets a sentence, not an error.
 */
export const MAX_ACTIVE_SLOTS = 14;

/** Where the engine starts a draft. Two anchors, then grow. */
export const CORE_COUNT = 2;

export const SLOT_DOMAINS = [
  'scripture',
  'prayer',
  'supplement',
  'family',
  'movement',
  'rest',
  'work',
  'custom',
] as const;

export type SlotDomain = (typeof SLOT_DOMAINS)[number];

export const DOMAIN_LABELS: Record<SlotDomain, string> = {
  scripture: 'The Word',
  prayer: 'Prayer',
  supplement: 'Supplement',
  family: 'Family',
  movement: 'Movement',
  rest: 'Rest',
  work: 'Work',
  custom: 'Something else',
};

export function toSlotDomain(value: unknown): SlotDomain {
  return SLOT_DOMAINS.includes(value as SlotDomain) ? (value as SlotDomain) : 'custom';
}

/** The editable fields of one anchor. */
export interface SlotForm {
  title: string;
  domain: SlotDomain;
  cueType: CueType;
  cueValue: string;
  why: string;
}

export function emptySlotForm(): SlotForm {
  return { title: '', domain: 'custom', cueType: 'time', cueValue: '', why: '' };
}

export function slotToForm(slot: RhythmSlot): SlotForm {
  return {
    title: slot.title,
    domain: toSlotDomain(slot.domain),
    cueType: slot.cueType,
    cueValue: slot.cue ?? '',
    why: slot.why ?? '',
  };
}

/**
 * Which window a clock cue falls in. Mirrors `windowOf` in `rhythm-slot` and
 * `rhythm-build` exactly, so the timeline does not reshuffle under the steward
 * the moment the server answers. Pure.
 */
export function windowOfCue(cue: string): TimeWindow {
  const match = /^(\d{1,2}):(\d{2})$/.exec(cue.trim());
  if (!match) return 'anytime';
  const hours = Number(match[1]);
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) return 'anytime';
  if (hours < 11) return 'morning';
  if (hours < 14) return 'midday';
  if (hours < 18) return 'afternoon';
  return 'evening';
}

/** The four windows the server will accept as an explicit `time_window`. */
export type EditableWindow = Exclude<TimeWindow, 'anytime'>;

/**
 * The explicit `time_window` to send with a clock cue, or `undefined` when the
 * cue is not a clock time and the server should decide for itself. Narrowing
 * lives here so the callers never have to cast. Pure.
 */
export function toEditableWindow(cue: string): EditableWindow | undefined {
  const window = windowOfCue(cue);
  return window === 'anytime' ? undefined : window;
}

/** Whether a form is complete enough to send. Pure. */
export function isSlotFormValid(form: SlotForm): boolean {
  if (form.title.trim().length === 0) return false;
  if (form.cueType === 'time') return /^\d{1,2}:\d{2}$/.test(form.cueValue.trim());
  return form.cueValue.trim().length > 0;
}

/**
 * The if-then sentence the steward will see, built the same way the server
 * builds it when none is supplied. Implementation intentions are the whole
 * mechanism here, so the preview has to be honest about what gets stored.
 * Pure.
 */
export function ifThenPreview(form: SlotForm): string {
  const title = form.title.trim();
  const cue = form.cueValue.trim();
  if (!title) return '';
  if (!cue) return `I ${title.toLowerCase()}.`;
  return `When ${cue}, I ${title.toLowerCase()}.`;
}

export function canAddSlot(count: number): boolean {
  return count < MAX_ACTIVE_SLOTS;
}

/** The line shown when the plan is full. Pure. */
export function fullPlanLine(count: number): string | null {
  if (count < MAX_ACTIVE_SLOTS) return null;
  return 'Your rhythm is full. Remove an anchor before adding another.';
}

/**
 * Move one slot up or down, returning a new array. Out-of-range moves are a
 * no-op rather than an error, so a fast double tap at the end of the list
 * cannot corrupt the order. Pure.
 */
export function moveSlot<T>(slots: readonly T[], from: number, direction: -1 | 1): T[] {
  const to = from + direction;
  if (from < 0 || from >= slots.length || to < 0 || to >= slots.length) return [...slots];
  const next = [...slots];
  const moved = next[from]!;
  next[from] = next[to]!;
  next[to] = moved;
  return next;
}

/**
 * Drop the suggestions that are already in the plan. The engine filters by
 * product and domain server-side, but the draft changes under the steward
 * between reads, so the list is filtered again here. Pure.
 */
export function openSuggestions(
  suggestions: readonly RhythmSuggestion[],
  slots: readonly RhythmSlot[],
): RhythmSuggestion[] {
  const products = new Set(slots.map((s) => s.productKey).filter(Boolean));
  const titles = new Set(slots.map((s) => s.title.toLowerCase()));
  return suggestions.filter(
    (s) => !(s.productKey && products.has(s.productKey)) && !titles.has(s.title.toLowerCase()),
  );
}

/**
 * How the draft is described before approval. Never states a number of days or
 * a start date: nothing is scheduled until the steward activates it. Pure.
 */
export function draftSummary(slots: readonly RhythmSlot[]): string {
  if (slots.length === 0) return 'Nothing is in your rhythm yet.';
  if (slots.length === 1) return 'One anchor, waiting on you.';
  return `${slots.length} anchors, waiting on you.`;
}
