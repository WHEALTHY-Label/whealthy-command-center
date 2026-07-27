import { cache } from 'react';
import { getPublicEnv } from '@/lib/env';

/** A single anchor in today's rhythm (read-only render in Slice 3). */
export interface DisciplineSlot {
  id?: string;
  title: string;
  ifThen?: string;
  timeWindow?: string;
  why?: string;
  done?: boolean;
}

/** Active-fast shape used to compute the fast-phase directive. */
export interface FastState {
  day: number;
  duration: number;
  phase?: string;
}

// The seven First Steps, in the live app's order. Destinations match the
// migrated routes.
export const FIRST_STEPS = [
  { key: 'bundle', label: 'Claim your bundle', href: '/claim' },
  { key: 'word', label: 'Read the Word', href: '/bible' },
  { key: 'wall', label: 'Visit the Prayer Wall', href: '/wall' },
  { key: 'record', label: 'File an entry in The Record', href: '/record' },
  { key: 'community', label: 'Post in the Community', href: '/community' },
  { key: 'fast', label: 'Begin The Fast', href: '/fast' },
  { key: 'code', label: 'Get your affiliate code', href: '/affiliate' },
] as const;

export interface FirstStepView {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

export interface FirstStepsProgress {
  done: number;
  total: number;
  nextHref: string | null;
  steps: FirstStepView[];
}

/**
 * The Daily Directive: the fast-phase line during an active fast, otherwise
 * the AI daily directive, otherwise a steady fallback. Pure and tested.
 */
export function selectDirective(input: {
  fast?: FastState | null;
  aiDirective?: string | null;
}): string {
  const fast = input.fast;
  if (fast && Number.isFinite(fast.day) && Number.isFinite(fast.duration) && fast.duration > 0) {
    // `·` is the live app's separator at index.html:15900.
    return `Day ${fast.day} of ${fast.duration}${fast.phase ? ` · ${fast.phase}` : ''}`;
  }
  const ai = input.aiDirective?.trim();
  return ai && ai.length > 0 ? ai : 'Govern the day.';
}

/** First Steps progress from the server flags. Pure and tested. */
export function firstStepsProgress(flags: Record<string, boolean> | undefined): FirstStepsProgress {
  const f = flags ?? {};
  const steps: FirstStepView[] = FIRST_STEPS.map((s) => ({
    key: s.key,
    label: s.label,
    href: s.href,
    done: f[s.key] === true,
  }));
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return { done, total: FIRST_STEPS.length, nextHref: next ? next.href : null, steps };
}

export interface BundleView {
  name: string | null;
  claimed: boolean;
}

/** Bundle card state from onboarding data. Pure and tested. */
export function bundleState(input: {
  bundle?: { name?: string } | undefined;
  bundle_claimed?: boolean | undefined;
}): BundleView {
  return {
    name: input.bundle?.name ?? null,
    claimed: input.bundle_claimed === true,
  };
}

// ---- Read-only fetchers (server-side, keyed by the validated session email) ----

function authedHeaders() {
  const env = getPublicEnv();
  return {
    'content-type': 'application/json',
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  };
}

export interface RhythmStatus {
  active: boolean;
  slots: DisciplineSlot[];
}

/** Today's disciplines from rhythm-status. Tolerant of shape drift. */
export const fetchRhythmStatus = cache(async (email: string): Promise<RhythmStatus> => {
  const env = getPublicEnv();
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_FN_BASE}/rhythm-status?email=${encodeURIComponent(email)}`,
      { method: 'POST', headers: authedHeaders(), cache: 'no-store' },
    );
    if (!res.ok) return { active: false, slots: [] };
    const data = (await res.json()) as Record<string, unknown>;
    const rawSlots =
      (Array.isArray(data.slots) && data.slots) ||
      (typeof data.active_plan === 'object' &&
        data.active_plan !== null &&
        Array.isArray((data.active_plan as Record<string, unknown>).slots) &&
        ((data.active_plan as Record<string, unknown>).slots as unknown[])) ||
      [];
    const slots: DisciplineSlot[] = (rawSlots as unknown[])
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s) => ({
        id: typeof s.id === 'string' ? s.id : undefined,
        title: String(s.title ?? s.name ?? s.domain ?? 'Anchor'),
        ifThen: typeof s.if_then_text === 'string' ? s.if_then_text : undefined,
        timeWindow: typeof s.time_window === 'string' ? s.time_window : undefined,
        why: typeof s.why === 'string' ? s.why : undefined,
        done: typeof s.done === 'boolean' ? s.done : undefined,
      }));
    return { active: slots.length > 0, slots };
  } catch {
    return { active: false, slots: [] };
  }
});

/**
 * What the wall looks like right now, in counts only.
 *
 * `wall-ai-context` refuses to return prayer text on the community scope by
 * design: the anonymity mask is display-only, so anything that could read
 * across anonymous prayers could correlate them. Counts are all this card
 * ever gets, and all it needs.
 */
export interface WallCommunity {
  livePosts: number;
  praysLast24h: number;
  answeredLast7d: number;
  topPostPrayCount: number;
}

export const EMPTY_WALL_COMMUNITY: WallCommunity = {
  livePosts: 0,
  praysLast24h: 0,
  answeredLast7d: 0,
  topPostPrayCount: 0,
};

function count(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Reads the community scope payload. Pure and tested. */
export function parseWallCommunity(raw: unknown): WallCommunity {
  if (typeof raw !== 'object' || raw === null) return EMPTY_WALL_COMMUNITY;
  const d = raw as Record<string, unknown>;
  return {
    livePosts: count(d.live_post_count),
    praysLast24h: count(d.prays_last_24h),
    answeredLast7d: count(d.answered_last_7d),
    topPostPrayCount: count(d.top_post_pray_count),
  };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The line under the dashboard wall card. The live app said "Stewards are
 * carrying things right now" whatever the numbers were; this says what is
 * actually true, and says nothing rather than inventing a number it does not
 * have. Pure and tested.
 */
export function wallGarnish(c: WallCommunity): string {
  const parts: string[] = [];
  if (c.livePosts > 0) parts.push(`${plural(c.livePosts, 'prayer', 'prayers')} on the wall`);
  if (c.praysLast24h > 0) parts.push(`${plural(c.praysLast24h, 'carry', 'carries')} today`);
  if (c.answeredLast7d > 0)
    parts.push(`${plural(c.answeredLast7d, 'answer', 'answers')} this week`);
  if (parts.length === 0) return 'The wall is quiet. Yours can be the first.';
  return `${parts.join(' · ')}.`;
}

/** Community counts for the dashboard wall card. Never throws. */
export const fetchWallCommunity = cache(async (email: string): Promise<WallCommunity> => {
  const env = getPublicEnv();
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_FN_BASE}/wall-ai-context`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ email, scope: 'community' }),
      cache: 'no-store',
    });
    if (!res.ok) return EMPTY_WALL_COMMUNITY;
    return parseWallCommunity(await res.json());
  } catch {
    return EMPTY_WALL_COMMUNITY;
  }
});

export interface GovernorState {
  aiDirective: string | null;
  fast: FastState | null;
}

function rec(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/**
 * Day N of an active fast, or null when there is no fast running today.
 *
 * Same arithmetic the Governor dock uses. Both dates are plain `YYYY-MM-DD`,
 * so the subtraction is done at UTC midnight and cannot drift by a day.
 */
export function activeFastDay(fast: Record<string, unknown>, todayIso: string): number | null {
  if (fast.status !== 'active') return null;
  const start = typeof fast.start_date === 'string' ? fast.start_date.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) return null;
  const ms = Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  const day = Math.floor(ms / 86400000) + 1;
  const duration = typeof fast.duration === 'number' ? fast.duration : 0;
  if (day < 1 || (duration > 0 && day > duration)) return null;
  return day;
}

/**
 * Turn the raw `fasts` row `governor-state` returns into the directive's view
 * of it. Pure and tested.
 *
 * `governor-state` returns the row verbatim: `status`, `start_date`,
 * `duration`, `plan`. It has never returned `day` or `phase`, so the port's
 * old shape check (`typeof rawFast.day === 'number'`) could not match any real
 * payload and the fast line never once rendered. The day is computed here and
 * the phase focus is read out of `plan`, exactly as the live app did at
 * index.html:15894 (`Day d of D · focus`).
 */
export function parseGovernorFast(raw: unknown, todayIso: string): FastState | null {
  const fast = rec(raw);
  const day = activeFastDay(fast, todayIso);
  if (day === null) return null;
  const duration = typeof fast.duration === 'number' ? fast.duration : 0;
  if (duration <= 0) return null;

  // The live app gated the whole fast line on `d && S.fast.plan`, so a fast
  // with no plan attached falls through to the AI directive rather than
  // printing a bare day count.
  const plan = rec(fast.plan);
  if (Object.keys(plan).length === 0) return null;
  const phases = Array.isArray(plan.phases) ? plan.phases.map(rec) : [];
  const phase = phases.find(
    (p) => typeof p.from === 'number' && typeof p.to === 'number' && day >= p.from && day <= p.to,
  );
  const phaseName = phase && typeof phase.name === 'string' ? phase.name : '';

  // `focus` is a map of phase name to a list of daily lines; the live app
  // cycled through it with `(day - 1) % length`.
  const focusMap = rec(plan.focus);
  const lines = phaseName && Array.isArray(focusMap[phaseName]) ? focusMap[phaseName] : [];
  const picked = lines.length > 0 ? lines[(day - 1) % lines.length] : undefined;
  const focus =
    typeof picked === 'string' && picked.trim().length > 0
      ? picked.trim()
      : 'Full routine. No exceptions.';

  return { day, duration, phase: focus };
}

/**
 * Daily directive + active-fast info out of a `governor-state` load.
 *
 * `governor-state` reads `{ action, email }` out of the JSON body and never
 * looks at the query string, and its outer catch answers a parse failure with
 * HTTP **200** `{ok:false}`, which is why the `ok` flag is checked here rather
 * than left to the transport. The port used to POST with no body at all, so
 * `req.json()` threw, `res.ok` was true, every field was absent, and the Daily
 * Directive was pinned to its fallback forever.
 *
 * The fetch itself moved to `loadGovernorState()` so the rail and the page
 * share one round trip. What is left is pure, and therefore tested.
 *
 * The day of the fast is counted in Chicago, the way `activeFastDay()` at
 * index.html:15351 counted it off `realToday()`. On UTC the Daily Directive
 * read a day ahead of the fast the steward was actually living, every evening
 * after 7pm.
 */
export function governorView(raw: unknown, todayIso: string): GovernorState {
  const data = rec(raw);
  if (data.ok !== true) return { aiDirective: null, fast: null };
  const directive =
    (typeof data.directive === 'string' && data.directive) ||
    (typeof data.daily_directive === 'string' && data.daily_directive) ||
    null;
  return { aiDirective: directive, fast: parseGovernorFast(data.fast, todayIso) };
}
