/**
 * Fast state derivation over the raw fast object that `governor-state`
 * stores and returns (action "load" → `fast`). The object is written by the
 * legacy builder, so every read here is tolerant: the wizard-era fields we
 * do not manage pass through untouched and get sent back verbatim on save.
 */

import { fmtTime } from './fastbuild';

export interface FastView {
  kind: 'none' | 'active' | 'overrun' | 'revealed' | 'closed';
  name: string;
  day: number;
  duration: number | null;
  endedDay: number | null;
  status: string;
  reportFiled: boolean;
  laid: string[];
  whys: string[];
  anchors: string[];
  cohortId: string | null;
  fastId: string | null;
  prayerId: string | null;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * `anchors` is stored as an object, not a list, so it has to be read into
 * display lines. An array is still accepted in case an older row carries one.
 */
export function anchorLines(v: unknown): string[] {
  if (Array.isArray(v)) return strArray(v);
  if (typeof v !== 'object' || v === null) return [];
  const a = v as Record<string, unknown>;
  const lines: string[] = [];
  if (typeof a.wake === 'string') lines.push(`Up by ${fmtTime(a.wake)}`);
  if (typeof a.lights === 'string') lines.push(`Lights out by ${fmtTime(a.lights)}`);
  if (typeof a.oz === 'number' && a.oz > 0) lines.push(`${a.oz} oz of hydration`);
  if (a.movement === true) lines.push('Morning movement');
  if (typeof a.laps === 'number' && a.laps > 0) {
    lines.push(`Daily walk, ${a.laps} lap${a.laps === 1 ? '' : 's'}`);
  }
  if (typeof a.journal === 'number' && a.journal > 0) {
    lines.push(`Journal ${a.journal} minutes`);
  }
  if (a.prayer === true) lines.push('Prayer, morning and night');
  return lines;
}

export function deriveFastView(rawFast: unknown, todayIso: string): FastView {
  const base: FastView = {
    kind: 'none',
    name: 'Your Fast',
    day: 0,
    duration: null,
    endedDay: null,
    status: '',
    reportFiled: false,
    laid: [],
    whys: [],
    anchors: [],
    cohortId: null,
    fastId: null,
    prayerId: null,
  };
  if (typeof rawFast !== 'object' || rawFast === null) return base;
  const f = rawFast as Record<string, unknown>;
  const status = typeof f.status === 'string' ? f.status : '';
  if (!status || status === 'discarded') return base;

  const plan =
    typeof f.plan === 'object' && f.plan !== null ? (f.plan as Record<string, unknown>) : {};
  // The builder writes the display name to `plan.fast_name` and stores
  // `fast_model` as an object, {id, title, figure, refs}. Older rows carry a
  // bare string in `fast_model`, so that shape is still read.
  const model =
    typeof f.fast_model === 'object' && f.fast_model !== null
      ? (f.fast_model as Record<string, unknown>)
      : {};
  const name =
    (typeof plan.fast_name === 'string' && plan.fast_name) ||
    (typeof model.title === 'string' && model.title) ||
    (typeof f.fast_model === 'string' && f.fast_model) ||
    (typeof f.fast_name === 'string' && f.fast_name) ||
    'Your Fast';
  const duration = typeof f.duration === 'number' && f.duration > 0 ? f.duration : null;

  // Day count matches the live app: whole days since start_date, one-based.
  let day = 0;
  if (typeof f.start_date === 'string') {
    const start = Date.parse(f.start_date);
    const today = Date.parse(todayIso);
    if (!Number.isNaN(start) && !Number.isNaN(today)) {
      day = Math.floor((today - start) / 86400000) + 1;
    }
  }

  const view: FastView = {
    ...base,
    name,
    day: Math.max(0, day),
    duration,
    endedDay: typeof f.ended_day === 'number' ? f.ended_day : null,
    status,
    reportFiled: plan.report_filed === true,
    laid: strArray(f.laid),
    whys: strArray(f.whys),
    anchors: anchorLines(f.anchors),
    cohortId: f.cohort_id === undefined || f.cohort_id === null ? null : String(f.cohort_id),
    fastId: f.id === undefined || f.id === null ? null : String(f.id),
    prayerId: f.prayer_id === undefined || f.prayer_id === null ? null : String(f.prayer_id),
  };

  if (status === 'active') {
    // A fixed-length fast whose last day has passed is finished; the page
    // offers the closing step rather than silently rewriting state.
    if (duration !== null && day > duration) return { ...view, kind: 'overrun' };
    return { ...view, kind: 'active' };
  }
  if (status === 'revealed') return { ...view, kind: 'revealed' };
  if (status === 'completed' || status === 'ended_early' || status === 'lapsed') {
    return { ...view, kind: 'closed' };
  }
  return { ...view, kind: 'active' };
}
