'use server';

import { revalidatePath } from 'next/cache';
import { askGovernor } from '@/lib/actions/governor';
import { getMemberContext, memberFn } from '@/lib/fn';
import {
  ATTACH_CATEGORIES,
  DEFAULT_ANCHORS,
  LIB,
  WHY_LABEL,
  bundleLine,
  buildFallbackPlan,
  composeFastRow,
  computeExclusions,
  findPattern,
  fmtTime,
  historyLine,
  memberLine,
  phaseRanges,
  recordLine,
  repairPrayerPlan,
  scriptureWhitelist,
  type Experience,
  type FastAnchors,
  type FastHistoryRow,
  type FastPlan,
  type PlanPhase,
  type PrayerWeek,
  type ProfileLite,
  type RecordEntryLite,
  type ScheduleRow,
  type WizardState,
} from '@/lib/fastbuild';

const GENERIC = 'The fast did not save. Please try again.';

export interface ForgeResult {
  ok: boolean;
  error?: string;
}

/* ---------- tolerant reads over whatever the model returned ---------- */

function obj(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
}

function strRecord(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(obj(v))) {
    if (typeof val === 'string' && val.trim()) out[k] = val.trim();
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

/* ---------- the wizard state arrives from the browser, so validate it ---------- */

const EXPERIENCES = new Set<Experience>(['never', 'few', 'life']);
const CARRIED = new Set(['alone', 'brother', 'cohort']);
const CATEGORIES = new Set(ATTACH_CATEGORIES);

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, Math.round(v)))
    : fallback;
}

function cleanTime(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback;
}

function cleanAnchors(v: unknown): FastAnchors {
  const a = obj(v);
  return {
    wake: cleanTime(a.wake, DEFAULT_ANCHORS.wake),
    lights: cleanTime(a.lights, DEFAULT_ANCHORS.lights),
    oz: clampInt(a.oz, 64, 160, DEFAULT_ANCHORS.oz),
    movement: a.movement !== false,
    laps: clampInt(a.laps, 0, 6, DEFAULT_ANCHORS.laps),
    journal: clampInt(a.journal, 5, 30, DEFAULT_ANCHORS.journal),
    prayer: true,
  };
}

function cleanState(raw: WizardState): WizardState | null {
  const laid = strArray(raw.laid)
    .map((s) => s.slice(0, 80))
    .slice(0, 30);
  const whys = strArray(raw.whys).filter((w) => w in WHY_LABEL);
  const exp = EXPERIENCES.has(raw.exp as Experience) ? (raw.exp as Experience) : null;
  const pattern = findPattern(raw.matchedId);
  if (laid.length === 0 || whys.length === 0 || !exp || !pattern) return null;
  const start = typeof raw.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.start)
    ? raw.start
    : null;
  return {
    laid,
    caffScope: raw.caffScope === 'all' || raw.caffScope === 'coffee' ? raw.caffScope : null,
    whys,
    exp,
    matchedId: pattern.id,
    altId: findPattern(raw.altId)?.id ?? null,
    dur: clampInt(raw.dur, 1, 40, pattern.days),
    start,
    recordConsent: raw.recordConsent === true,
    anchors: cleanAnchors(raw.anchors),
    carried: CARRIED.has(raw.carried) ? raw.carried : 'alone',
    structureOnly: raw.structureOnly === true,
    safetyDiabetic: raw.safetyDiabetic === true,
    safetyBP: raw.safetyBP === true,
    safetyEating: raw.safetyEating === true,
    attachedPrayerId: typeof raw.attachedPrayerId === 'string' ? raw.attachedPrayerId : null,
    attachedNewBody: str(raw.attachedNewBody).slice(0, 2000),
    attachedNewCategory: CATEGORIES.has(str(raw.attachedNewCategory))
      ? str(raw.attachedNewCategory)
      : '',
    takingOn: strArray(raw.takingOn)
      .map((s) => s.slice(0, 120))
      .slice(0, 30),
    ackAt: typeof raw.ackAt === 'string' ? raw.ackAt : null,
  };
}

/* ---------- product placements, for the one context line that names them ---------- */

const PLACEMENTS: Record<string, string[]> = {
  'genius-guice': ['Genius Guice', 'Hydration Powder'],
  'hydration-pack': ['Hydration Powder'],
  'coffee-plus': ['Genius Coffee'],
  'charge-plus': ['Charge Pack'],
  'genius-joe': ['Genius Joe', 'Hydration Powder'],
  boss: ['Boss', 'Hydration Powder'],
  charge: ['Charge', 'Hydration Powder'],
};

function readProfile(data: Record<string, unknown>, name: string): ProfileLite {
  const p = obj(data.profile);
  return {
    name,
    identityProfile: str(p.identity_profile) || null,
    season: str(p.season) || null,
    archetype: str(p.archetype) || null,
    recurringPeople: strArray(p.recurring_people).slice(0, 5),
    recurringBurdens: strArray(p.recurring_burdens).slice(0, 5),
  };
}

function readEntries(data: Record<string, unknown>): RecordEntryLite[] {
  if (!Array.isArray(data.entries)) return [];
  return data.entries
    .map((e) => obj(e))
    .map((e) => ({
      text: str(e.text),
      tone: str(e.tone) || 'mixed',
      burned: e.burned === true,
    }));
}

/**
 * The most recent fast, read from index 0. `governor-state` orders `history`
 * created_at DESC, so the live app's `history[length - 1]` is the OLDEST row;
 * that is a bug we do not carry forward.
 */
function readLastFast(data: Record<string, unknown>): FastHistoryRow | null {
  if (!Array.isArray(data.history) || data.history.length === 0) return null;
  const h = obj(data.history[0]);
  if (Object.keys(h).length === 0) return null;
  return {
    model: str(h.model) || 'Fast',
    duration: typeof h.duration === 'number' ? h.duration : null,
    ended_day: typeof h.ended_day === 'number' ? h.ended_day : null,
    finished: h.finished === true,
    weak_rule: str(h.weak_rule) || null,
  };
}

/* ---------- the forge ---------- */

/**
 * Build the fast. Three AI tasks run in parallel and a fourth, the scripture
 * selection, runs after them because it needs the phase names. Every one of
 * them is individually caught: a failure falls back to the deterministic plan
 * for that section only, so a fast is always produced.
 */
export async function forgeFast(rawState: WizardState): Promise<ForgeResult> {
  const state = cleanState(rawState);
  if (!state) return { ok: false, error: 'Some answers went missing. Please start again.' };
  const pattern = findPattern(state.matchedId);
  if (!pattern) return { ok: false, error: GENERIC };

  const member = await getMemberContext();
  if (!member) return { ok: false, error: 'Please sign in again.' };

  const load = await memberFn('governor-state', { action: 'load' });
  if (!load.ok) return { ok: false, error: GENERIC };
  const data = load.data;

  const todayIso = new Date().toISOString().slice(0, 10);
  const duration = state.dur ?? pattern.days;
  const startDate = state.start ?? todayIso;
  const exclusions = computeExclusions(state.laid, state.caffScope);
  const phases = phaseRanges(duration);
  const weeks = Math.ceil(duration / 7);
  const productState = str(data.product_state) || 'unequipped';
  const equipped = productState === 'equipped';
  const bundleKey = str(data.bundle_key);
  const profile = readProfile(data, member.name);
  const entries = readEntries(data);
  const lastFast = readLastFast(data);
  const primaryWhy = state.whys[0] ?? 'nearness';
  const anchors = state.anchors;

  const fallback = buildFallbackPlan({
    pattern,
    duration,
    laid: state.laid,
    whys: state.whys,
    caffScope: state.caffScope,
    anchors,
    takingOn: state.takingOn,
    exclusions,
    equipped,
  });

  const ctx = [
    `This fast follows the pattern of ${pattern.title} (${pattern.figure}), scripture ${pattern.refs.join(', ')}: ${pattern.pattern}`,
    memberLine(profile),
    `Laying down: ${state.laid.join(', ')}${state.caffScope === 'all' ? ' (caffeine altogether)' : ''}. Whys: ${state.whys
      .map((w) => WHY_LABEL[w] ?? w)
      .join('; ')}. Experience: ${state.exp}. ${duration} days starting ${startDate}.`,
    `Anchors: wake ${fmtTime(anchors.wake)}, lights out ${fmtTime(anchors.lights)}, hydration ${anchors.oz} oz daily, morning movement ${
      anchors.movement ? 'on (bodyweight only)' : 'off'
    }, ${anchors.laps} laps daily, journal ${anchors.journal} min, prayer morning and night.`,
    bundleLine(equipped, str(data.bundle_name) || null, PLACEMENTS[bundleKey] ?? [], exclusions),
    recordLine(state.recordConsent, profile, entries),
    historyLine(lastFast),
    state.structureOnly
      ? 'IMPORTANT: member indicated total food abstention. Structure everything EXCEPT dietary mechanics. One line directs the dietary piece to their doctor and pastor.'
      : '',
    'This is organizing what the member chose around a scriptural pattern, never advising. Product copy rules: placement only, never any bodily outcome.',
  ]
    .filter((line) => line.length > 0)
    .join('\n')
    .slice(0, 4000);

  const recordNote = state.recordConsent
    ? ' Where his record names a specific window or a person he carries, let that land in one or two lines.'
    : '';

  const [identity, schedule, phaseOut] = await Promise.all([
    askGovernor(
      'fast_identity',
      `${ctx}

Write the fast's identity and rules FOR THIS MAN. The rules must read like a man wrote them for himself, each one in its own voice. NEVER use a repeating template like "No X. None. All N days." Vary sentence structure on every rule.${recordNote} 6 to 9 rules total: one for each laid-down item, then the anchors (lights out, wake, hydration, journal, prayer). Each under 16 words.
Return JSON: {"fast_name":"3 to 6 word all-caps name from the scriptural pattern","model_line":"one sentence under 25 words naming the biblical pattern and why it fits what he carries","rules":["..."]}`,
    ).catch(() => ({ ok: false, out: null })),
    askGovernor(
      'fast_schedule',
      `${ctx}

Write his daily schedule, 8 to 11 rows from wake to lights out. Each action written TO him, not generic: pace the hydration checkpoints to his ${anchors.oz} oz across his real waking window, place allowed products by name at their time, tie the morning prayer to this week's passage and the night prayer to what he is carrying.${recordNote} Vary the phrasing, no template lines.
Return JSON: {"daily_schedule":[{"time":"6:40am","action":"..."}]}`,
    ).catch(() => ({ ok: false, out: null })),
    askGovernor(
      'fast_phases',
      `${ctx}

Phases are fixed: ${phases.map((p) => `${p.name} days ${p.from} to ${p.to}`).join('; ')}.
For each phase write a goal line under 20 words, personal to what he laid down and why, and a milestone journal check line. Then the after-the-fast section.
Return JSON: {"phase_goals":{"PhaseName":"..."},"milestones":{"PhaseName":"..."},"after":{"keep":"1 to 2 sentences on which of HIS anchors are worth keeping for life","return":"${
        exclusions.length > 0
          ? ' 1 to 2 honest sentences: what he laid down may return after the final day, and a governed routine exists for that hour if he chooses not to pick it back up. No pressure.'
          : 'empty string'
      }"}}`,
    ).catch(() => ({ ok: false, out: null })),
  ]);

  const idOut = identity.ok ? obj(identity.out) : {};
  const schedOut = schedule.ok ? obj(schedule.out) : {};
  const phaseData = phaseOut.ok ? obj(phaseOut.out) : {};

  const aiSchedule: ScheduleRow[] = Array.isArray(schedOut.daily_schedule)
    ? schedOut.daily_schedule
        .map((r) => obj(r))
        .filter((r) => str(r.time) && str(r.action))
        .map((r): ScheduleRow => ({ time: str(r.time), action: str(r.action) }))
    : [];
  const goals = strRecord(phaseData.phase_goals);
  const milestones = strRecord(phaseData.milestones);
  const after = obj(phaseData.after);

  /* The scripture pass needs the phase names, so it runs last. */
  const wl = scriptureWhitelist();
  const closingRule =
    weeks > 1
      ? `Final week night must be ${LIB.constants.close[0]}.`
      : "This fast is one week or shorter: the closing passages are handled at completion, so week 1 night must draw from the why lists or the fast's own anchor passage, never the closing passages.";
  const scripturePrompt = `Select scripture references for a ${duration} day fast following the pattern of ${pattern.title}, whys: ${state.whys.join(', ')}. ${weeks} week(s).
Select ONLY from these lists, never write verse text.
The fast's own anchor passages: ${pattern.refs.join('; ')}
Why lists: ${state.whys.map((w) => `${w}: ${(LIB.why[w] ?? []).join(', ')}`).join(' | ')}
Theme lists: ${Object.entries(LIB.themes)
    .map(([k, v]) => `${k}: ${v.join(', ')}`)
    .join(' | ')}
Constants: week 1 morning must be ${LIB.constants.open}. The renewal or breakthrough week must include ${LIB.constants.renewal} where one exists. ${closingRule} Where it fits, use this fast's own anchor passage in an early week.
Phases: ${phases.map((p) => `${p.name} (${p.theme}) days ${p.from}-${p.to}`).join('; ')}.
Also write per-phase journal prompts (one question each, under 18 words) and 3 short daily focus lines per phase (each under 12 words, imperative, concrete, tied to what he laid down).
Return JSON:
{"prayer_plan":[{"week":1,"theme":"","morning":"exact ref","night":"exact ref"}],
"journal_prompts":{"PhaseName":"question"},
"focus":{"PhaseName":["line","line","line"]}}`;

  const scriptureCall = await askGovernor('fast_scripture', scripturePrompt, {
    scriptureWhitelist: wl,
  }).catch(() => ({ ok: false, out: null }));
  const scriptureOut = scriptureCall.ok ? obj(scriptureCall.out) : {};

  const rawPrayer: PrayerWeek[] = Array.isArray(scriptureOut.prayer_plan)
    ? scriptureOut.prayer_plan.map((w) => {
        const row = obj(w);
        return {
          week: typeof row.week === 'number' ? row.week : 0,
          theme: str(row.theme),
          morning: str(row.morning),
          night: str(row.night),
        };
      })
    : [];
  const prayerPlan =
    rawPrayer.length === weeks
      ? repairPrayerPlan(rawPrayer, phases, weeks, primaryWhy)
      : fallback.prayer_plan;
  const journalPrompts = strRecord(scriptureOut.journal_prompts);
  const focus = listRecord(scriptureOut.focus);

  const mergedPhases: PlanPhase[] = phases.map((p, i) => {
    const fb = fallback.phases[i];
    return {
      ...p,
      goal: goals[p.name] ?? fb?.goal ?? '',
      milestone: milestones[p.name] ?? fb?.milestone ?? '',
    };
  });

  const aiRules = strArray(idOut.rules).map((r) => r.slice(0, 200));
  const plan: FastPlan = {
    fast_name: str(idOut.fast_name) || fallback.fast_name,
    model_line: str(idOut.model_line) || fallback.model_line || pattern.line,
    rules: aiRules.length > 0 ? aiRules : fallback.rules,
    daily_schedule: aiSchedule.length > 0 ? aiSchedule : fallback.daily_schedule,
    phases: mergedPhases,
    prayer_plan: prayerPlan,
    journal_prompts: Object.keys(journalPrompts).length > 0 ? journalPrompts : fallback.journal_prompts,
    focus: Object.keys(focus).length > 0 ? focus : fallback.focus,
    after: {
      keep: str(after.keep) || fallback.after.keep,
      return: str(after.return) || fallback.after.return,
    },
    taking_on: state.takingOn.slice(),
  };

  /* The attached prayer: an existing one by id, or a new one created now. */
  let prayerId = state.attachedPrayerId;
  let attachedBody = '';
  if (prayerId) {
    const read = await memberFn('prayers-read', {});
    if (read.ok) {
      const rows = Array.isArray(read.data.handovers)
        ? read.data.handovers
        : Array.isArray(read.data)
          ? (read.data as unknown[])
          : [];
      const hit = rows.map((r) => obj(r)).find((r) => String(r.id) === prayerId);
      attachedBody = hit ? str(hit.body) : '';
    }
  } else if (state.attachedNewBody && state.attachedNewCategory) {
    const created = await memberFn('prayers-write', {
      action: 'create',
      body: state.attachedNewBody,
      category: state.attachedNewCategory,
    });
    if (created.ok && created.data.id !== undefined && created.data.id !== null) {
      prayerId = String(created.data.id);
      attachedBody = state.attachedNewBody;
    }
  }

  const row = composeFastRow(state, pattern, plan, {
    productState,
    prayerId,
    attachedPrayerBody: attachedBody,
    todayIso,
  });

  const save = await memberFn('governor-state', { action: 'save_fast', fast: row });
  if (!save.ok || save.data.ok === false) return { ok: false, error: GENERIC };

  revalidatePath('/fast');
  revalidatePath('/dashboard');
  return { ok: true };
}
