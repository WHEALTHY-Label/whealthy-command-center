/**
 * Reading a built plan back off the raw `fasts` row for the reveal screen.
 *
 * The row is written by the builder (this app's or the legacy one's), so every
 * read is tolerant: a missing or malformed section renders as empty rather
 * than throwing, and the schedule is filtered through the fast's own
 * exclusions exactly as the live reveal does.
 */

import {
  endDayKey,
  filterSchedule,
  niceDate,
  type PlanPhase,
  type PrayerWeek,
  type ScheduleRow,
} from './fastbuild';

export interface RevealData {
  name: string;
  range: string;
  duration: number;
  modelLine: string;
  refs: string[];
  rules: string[];
  schedule: ScheduleRow[];
  phases: PlanPhase[];
  prayerPlan: PrayerWeek[];
  journalPrompts: Record<string, string>;
  focus: Record<string, string[]>;
  after: { keep: string; return: string };
  oz: number;
  productState: string;
  /**
   * The steward answered "Not During This Fast" on the equip card. Stamped on
   * the plan so the card stays down across reloads and devices, the same way
   * `report_filed` is stamped when the closing report is filed.
   */
  equipDismissed: boolean;
}

function obj(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function strRecord(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(obj(v))) {
    if (typeof val === 'string') out[k] = val;
  }
  return out;
}

function listRecord(v: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, val] of Object.entries(obj(v))) {
    const list = strArray(val);
    if (list.length > 0) out[k] = list;
  }
  return out;
}

export function parseReveal(rawFast: unknown): RevealData | null {
  const f = obj(rawFast);
  if (Object.keys(f).length === 0) return null;
  const plan = obj(f.plan);
  const model = obj(f.fast_model);

  const duration = typeof f.duration === 'number' && f.duration > 0 ? f.duration : 0;
  const start = str(f.start_date);
  const range =
    start && duration > 0
      ? `${niceDate(start)} through ${niceDate(endDayKey(start, duration))} · ${duration} days`
      : start
        ? niceDate(start)
        : '';

  const anchors = obj(f.anchors);
  const exclusions = strArray(f.exclusions);

  const schedule = Array.isArray(plan.daily_schedule)
    ? plan.daily_schedule
        .map((r) => obj(r))
        .filter((r) => typeof r.time === 'string' || typeof r.action === 'string')
        .map((r): ScheduleRow => ({ time: str(r.time), action: str(r.action) }))
    : [];

  const phases = Array.isArray(plan.phases)
    ? plan.phases
        .map((p) => obj(p))
        .filter((p) => typeof p.name === 'string')
        .map(
          (p): PlanPhase => ({
            name: str(p.name),
            from: typeof p.from === 'number' ? p.from : 1,
            to: typeof p.to === 'number' ? p.to : duration || 1,
            theme: str(p.theme),
            goal: str(p.goal),
            milestone: str(p.milestone),
          }),
        )
    : [];

  const prayerPlan = Array.isArray(plan.prayer_plan)
    ? plan.prayer_plan
        .map((w) => obj(w))
        .filter((w) => typeof w.week === 'number')
        .map(
          (w): PrayerWeek => ({
            week: w.week as number,
            theme: str(w.theme),
            morning: str(w.morning),
            night: str(w.night),
          }),
        )
    : [];

  const after = obj(plan.after);

  return {
    name: str(plan.fast_name) || str(model.title) || str(f.fast_model) || 'Your Fast',
    range,
    duration,
    modelLine: str(plan.model_line),
    refs: strArray(model.refs),
    rules: strArray(plan.rules),
    schedule: filterSchedule(schedule, exclusions),
    phases,
    prayerPlan,
    journalPrompts: strRecord(plan.journal_prompts),
    focus: listRecord(plan.focus),
    after: { keep: str(after.keep), return: str(after.return) },
    oz: typeof anchors.oz === 'number' ? anchors.oz : 0,
    productState: str(f.product_state, 'unequipped'),
    equipDismissed: plan.equip_dismissed === true,
  };
}

/** The plan name with its first number emphasised, as the live reveal does. */
export function splitPlanName(name: string): { before: string; number: string; after: string } {
  const m = /(\d+)/.exec(name);
  if (!m || m.index === undefined) return { before: name, number: '', after: '' };
  return {
    before: name.slice(0, m.index),
    number: m[1] ?? '',
    after: name.slice(m.index + (m[1]?.length ?? 0)),
  };
}
