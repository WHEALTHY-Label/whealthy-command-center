/**
 * The Rhythm Assessment: the reduced Morningness-Eveningness Questionnaire
 * (rMEQ; Adan & Almirall 1991 — items 1, 7, 10, 18, 19 of the Horne-Ostberg
 * MEQ) plus the clock, work shape, anchors, accountability and fasting inputs
 * the rhythm engine needs.
 *
 * The option wording is verbatim from the validated instrument; the point
 * values are calibrated to that wording, so neither may be paraphrased. Point
 * values are never shown to the steward and the word "score" never appears in
 * the UI — the chronotype is returned by `rhythm-assess` and quietly shapes
 * the timing skeleton.
 */

export type Chronotype = 'morning' | 'intermediate' | 'evening';

export interface RmeqOption {
  label: string;
  points: number;
}

export interface RmeqQuestion {
  id: string;
  prompt: string;
  options: RmeqOption[];
}

export const RMEQ_QUESTIONS: readonly RmeqQuestion[] = [
  {
    id: 'rise',
    prompt: 'Approximately what time would you get up if you were entirely free to plan your day?',
    options: [
      { label: '5:00 - 6:30 am', points: 5 },
      { label: '6:30 - 7:45 am', points: 4 },
      { label: '7:45 - 9:45 am', points: 3 },
      { label: '9:45 - 11:00 am', points: 2 },
      { label: '11:00 am - 12:00 noon', points: 1 },
    ],
  },
  {
    id: 'first_half_hour',
    prompt: 'During the first half hour after you wake up in the morning, how tired do you feel?',
    options: [
      { label: 'Very tired', points: 1 },
      { label: 'Fairly tired', points: 2 },
      { label: 'Fairly refreshed', points: 3 },
      { label: 'Very refreshed', points: 4 },
    ],
  },
  {
    id: 'evening_tired',
    prompt: 'At what time in the evening do you feel tired and, as a result, in need of sleep?',
    options: [
      { label: '8:00 - 9:00 pm', points: 5 },
      { label: '9:00 - 10:15 pm', points: 4 },
      { label: '10:15 pm - 12:45 am', points: 3 },
      { label: '12:45 - 2:00 am', points: 2 },
      { label: '2:00 - 3:00 am', points: 1 },
    ],
  },
  {
    id: 'best_time',
    prompt: 'At what time of day do you feel your best?',
    options: [
      { label: '5:00 - 8:00 am', points: 5 },
      { label: '8:00 - 10:00 am', points: 4 },
      { label: '10:00 am - 5:00 pm', points: 3 },
      { label: '5:00 - 10:00 pm', points: 2 },
      { label: '10:00 pm - 5:00 am', points: 1 },
    ],
  },
  {
    id: 'self_type',
    prompt:
      'One hears about "morning types" and "evening types." Which do you consider yourself to be?',
    options: [
      { label: 'Definitely a morning type', points: 6 },
      { label: 'Rather more a morning type than an evening type', points: 4 },
      { label: 'Rather more an evening type than a morning type', points: 2 },
      { label: 'Definitely an evening type', points: 0 },
    ],
  },
] as const;

export const RMEQ_COUNT = RMEQ_QUESTIONS.length;

export type AccountabilityPref = 'self' | 'partner' | 'group';

export const ACCOUNTABILITY_OPTIONS: ReadonlyArray<{
  value: AccountabilityPref;
  label: string;
  note: string;
}> = [
  { value: 'self', label: 'Just me', note: 'You carry it quietly, on your own.' },
  { value: 'partner', label: 'One person', note: 'A spouse or friend who checks in with you.' },
  { value: 'group', label: 'A circle', note: 'Your group sees your progress and prays with you.' },
];

export type FamilyAnchorType = 'date_night' | 'kids' | 'spouse' | 'meal';

export const FAMILY_ANCHOR_TYPES: ReadonlyArray<{ value: FamilyAnchorType; label: string }> = [
  { value: 'date_night', label: 'Date night' },
  { value: 'spouse', label: 'Time with my spouse' },
  { value: 'kids', label: 'Time with my kids' },
  { value: 'meal', label: 'A meal together' },
];

export const WEEKDAYS: ReadonlyArray<{ value: number; short: string }> = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 7, short: 'Sun' },
];

export interface AnchorEntry {
  /** Free-text label for a non-negotiable, or the anchor type for a family anchor. */
  label: string;
  /** "When" half of the if-then: "after breakfast", "Friday 7pm". */
  when: string;
}

export interface AssessmentAnswers {
  /** One chosen point value per rMEQ question; null until answered. */
  rmeq: Array<number | null>;
  wakeTime: string;
  sleepTime: string;
  workStart: string;
  workEnd: string;
  workDays: number[];
  remote: boolean;
  nonNegotiables: AnchorEntry[];
  familyAnchors: Array<{ type: FamilyAnchorType; when: string }>;
  accountability: AccountabilityPref | null;
  fastingOptIn: boolean;
  fastingWindow: string;
}

export function emptyAnswers(): AssessmentAnswers {
  return {
    rmeq: Array.from({ length: RMEQ_COUNT }, () => null),
    wakeTime: '',
    sleepTime: '',
    workStart: '',
    workEnd: '',
    workDays: [1, 2, 3, 4, 5],
    remote: false,
    nonNegotiables: [],
    familyAnchors: [],
    accountability: null,
    fastingOptIn: false,
    fastingWindow: '',
  };
}

/** Sum of the five chosen point values, or null while any answer is missing. Pure. */
export function rmeqScore(items: ReadonlyArray<number | null>): number | null {
  if (items.length !== RMEQ_COUNT) return null;
  let total = 0;
  for (const item of items) {
    if (typeof item !== 'number' || !Number.isFinite(item)) return null;
    total += item;
  }
  return total;
}

/**
 * Chronotype cutoffs. These mirror `rhythm-assess` exactly (morning >= 18,
 * evening <= 11, otherwise intermediate). The server remains the source of
 * truth; this is only used to reflect the result back to the steward.
 */
export function chronotypeOf(score: number | null): Chronotype | null {
  if (score === null) return null;
  if (score >= 18) return 'morning';
  if (score <= 11) return 'evening';
  return 'intermediate';
}

export function chronotypeLine(chronotype: Chronotype): string {
  switch (chronotype) {
    case 'morning':
      return 'You rise well. Your rhythm will lean into the early hours, while your attention is cheapest.';
    case 'evening':
      return 'Your strength arrives later in the day. Your rhythm will stop fighting your mornings.';
    case 'intermediate':
      return 'You sit in the middle, which is the most flexible place to build from.';
  }
}

/** The steps of the flow, in order: five rMEQ items, then the shape of the day. */
export const STEPS = [
  'rmeq-0',
  'rmeq-1',
  'rmeq-2',
  'rmeq-3',
  'rmeq-4',
  'clock',
  'work',
  'anchors',
  'accountability',
  'summary',
] as const;

export type Step = (typeof STEPS)[number];

/** Whether the steward may advance past a given step. Pure. */
export function canAdvance(step: Step, answers: AssessmentAnswers): boolean {
  switch (step) {
    case 'rmeq-0':
    case 'rmeq-1':
    case 'rmeq-2':
    case 'rmeq-3':
    case 'rmeq-4':
      return typeof answers.rmeq[Number(step.slice(5))] === 'number';
    case 'clock':
      return Boolean(answers.wakeTime && answers.sleepTime);
    case 'work':
      return true;
    case 'anchors':
      return true;
    case 'accountability':
      return answers.accountability !== null;
    case 'summary':
      return rmeqScore(answers.rmeq) !== null && Boolean(answers.wakeTime && answers.sleepTime);
  }
}

/** Format an HH:MM 24-hour clock string for display. Pure. */
export function formatClock(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = match[2]!;
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) return value;
  const suffix = hours < 12 ? 'am' : 'pm';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${minutes} ${suffix}`;
}

/** The reflected-back summary shown before anything is saved. Pure. */
export function summaryLines(answers: AssessmentAnswers): string[] {
  const lines: string[] = [];
  const chronotype = chronotypeOf(rmeqScore(answers.rmeq));
  if (chronotype) lines.push(chronotypeLine(chronotype));
  if (answers.wakeTime && answers.sleepTime) {
    lines.push(
      `Your day runs from ${formatClock(answers.wakeTime)} to ${formatClock(answers.sleepTime)}.`,
    );
  }
  if (answers.workStart && answers.workEnd) {
    const days = answers.workDays.length;
    lines.push(
      `You work ${formatClock(answers.workStart)} to ${formatClock(answers.workEnd)}, ${days} ${days === 1 ? 'day' : 'days'} a week${answers.remote ? ', from home' : ''}.`,
    );
  }
  for (const item of answers.nonNegotiables) {
    if (item.label) lines.push(`${item.label}${item.when ? ` — ${item.when}` : ''}.`);
  }
  for (const anchor of answers.familyAnchors) {
    const label = FAMILY_ANCHOR_TYPES.find((t) => t.value === anchor.type)?.label ?? 'Family time';
    if (anchor.when) lines.push(`${label} — ${anchor.when}.`);
  }
  const accountability = ACCOUNTABILITY_OPTIONS.find((o) => o.value === answers.accountability);
  if (accountability)
    lines.push(`You want to carry this with: ${accountability.label.toLowerCase()}.`);
  if (answers.fastingOptIn) {
    lines.push(
      `Fasting is part of your rhythm${answers.fastingWindow ? ` — ${answers.fastingWindow}` : ''}.`,
    );
  }
  return lines;
}

/**
 * Which domain a free-text non-negotiable belongs to.
 *
 * This is load bearing, not decoration. `rhythm-build` looks its two core
 * slots up by domain: `non_negotiables.find(n => n.domain === "scripture")`
 * supplies the cue for "Open the Word" and `=== "prayer"` supplies the cue for
 * the evening prayer check-in (rhythm-build/index.ts:43 and :46). Sending
 * `domain: 'custom'` for everything, which this used to do, meant neither
 * lookup ever matched, so a steward who typed "The Word / before coffee" got
 * the generic "after the morning cup" back and his own wording was thrown
 * away.
 *
 * The assessment asks for the label in free text (the field's placeholder is
 * "The Word"), so the classification is by keyword. Anything unrecognised
 * stays `custom`, which is what the rhythm editor's own domain select defaults
 * to at index.html:20519.
 */
export function nonNegotiableDomain(label: string): string {
  const t = label.toLowerCase();
  if (/\b(pray|prayer|prayers|praying|intercession|intercede|rosary)\b/.test(t)) return 'prayer';
  if (
    /\b(word|bible|scripture|scriptures|devotion|devotional|devotions|psalm|psalms|gospel|reading|verse|verses)\b/.test(
      t,
    ) ||
    t.includes('quiet time')
  ) {
    return 'scripture';
  }
  return 'custom';
}

/** The `rhythm-assess` request body. Field names match the edge function. */
export interface AssessPayload {
  rmeq_items: number[];
  wake_time: string | null;
  sleep_time: string | null;
  work_shape: { start: string; end: string; days: number[]; remote: boolean };
  non_negotiables: Array<{ label: string; when: string; domain: string }>;
  family_anchors: Array<{ type: FamilyAnchorType; when: string; cadence: string }>;
  accountability_pref: AccountabilityPref | null;
  fasting_pref: { opt_in: boolean; window: string | null };
}

/** Shape the collected answers into the edge function's payload. Pure. */
export function buildAssessPayload(answers: AssessmentAnswers): AssessPayload {
  return {
    rmeq_items: answers.rmeq.map((n) => (typeof n === 'number' ? n : 0)),
    wake_time: answers.wakeTime || null,
    sleep_time: answers.sleepTime || null,
    work_shape: {
      start: answers.workStart,
      end: answers.workEnd,
      days: [...answers.workDays].sort((a, b) => a - b),
      remote: answers.remote,
    },
    non_negotiables: answers.nonNegotiables
      .filter((item) => item.label.trim().length > 0)
      .map((item) => {
        const label = item.label.trim();
        return { label, when: item.when.trim(), domain: nonNegotiableDomain(label) };
      }),
    family_anchors: answers.familyAnchors
      .filter((anchor) => anchor.when.trim().length > 0)
      .map((anchor) => ({ type: anchor.type, when: anchor.when.trim(), cadence: 'weekly' })),
    accountability_pref: answers.accountability,
    fasting_pref: { opt_in: answers.fastingOptIn, window: answers.fastingWindow || null },
  };
}
