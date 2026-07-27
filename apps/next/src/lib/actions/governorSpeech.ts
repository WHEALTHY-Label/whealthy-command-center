'use server';

import { memberFn } from '@/lib/fn';
import { askGovernor } from '@/lib/actions/governor';
// One definition of the fast-day arithmetic, shared with the Daily Directive.
// It used to be copied here verbatim, which meant the Governor and the
// dashboard could drift on the same question of what day of the fast it is.
import { activeFastDay } from '@/lib/dashboard';
import { chicagoToday } from '@/lib/today';
import {
  buildRouterPrompt,
  coerceForSurface,
  parseIntent,
  planDispatch,
  reportOpenAt,
  type Dispatch,
  type GovernorContext,
  type GovernorIntentId,
} from '@/lib/governorIntent';

/**
 * The Governor's turn: one spoken sentence in, one decided action out.
 *
 * The live app called governor-ai straight from the browser with no auth
 * header at all, so anyone who knew an approved member's email could invoke
 * the router, and by extension `burn_entry` and `save_profile`, from any
 * origin. Routing through a server action means the email is the validated
 * session email and can never be supplied by the caller.
 */

export interface GovernorTurn {
  ok: boolean;
  intent: GovernorIntentId;
  dispatch: Dispatch;
  /** A reference the Governor may offer after the action lands. */
  scriptureRef: string;
  /** 1 to 5. Below 4 the Governor offers the passage rather than reading it. */
  scriptureComfort: number;
}

interface Snapshot {
  context: GovernorContext;
  fastDay: number | null;
  fastDuration: number | null;
  filedToday: boolean;
  bundleName: string | null;
  affiliateLink: string | null;
  scriptureComfort: number;
  profile: Record<string, unknown>;
}

function rec(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * One `governor-state` load, reshaped into what the router prompt and the
 * dispatcher each need. A failed load still produces a usable snapshot: the
 * Governor degrades to journalling rather than refusing to listen.
 */
async function snapshot(
  currentView: string,
  todayIso: string,
  localMinutes: number,
): Promise<Snapshot> {
  const empty: Snapshot = {
    context: {
      currentView,
      fastState: 'none',
      reportOpen: reportOpenAt(localMinutes) ? 'open' : 'closed until 8:45pm',
      filedToday: 'no',
      threads: 'none yet',
      profileDigest: 'season Building; carries none; scripture comfort 1; tone standard',
    },
    fastDay: null,
    fastDuration: null,
    filedToday: false,
    bundleName: null,
    affiliateLink: null,
    scriptureComfort: 1,
    profile: {},
  };

  const load = await memberFn('governor-state', { action: 'load' });
  if (!load.ok || load.data.ok !== true) return empty;
  const d = load.data;

  const entries = Array.isArray(d.entries) ? d.entries.map(rec) : [];
  const live = entries.filter((e) => e.burned !== true);
  const filedToday = live.some((e) => s(e.entry_date).slice(0, 10) === todayIso);
  const threads =
    live
      .slice(0, 3)
      .map((e) => s(e.text).slice(0, 300))
      .filter(Boolean)
      .join(' | ') || 'none yet';

  const fast = rec(d.fast);
  const fastStatus = s(fast.status) || 'none';
  const fastDay = activeFastDay(fast, todayIso);
  const duration = typeof fast.duration === 'number' ? fast.duration : null;

  const profile = rec(d.profile);
  const comfortRaw = profile.scripture_comfort;
  const comfort =
    typeof comfortRaw === 'number' && comfortRaw >= 1 && comfortRaw <= 5 ? comfortRaw : 1;
  const topBurden = Array.isArray(profile.recurring_burdens)
    ? s(rec(profile.recurring_burdens[0]).name)
    : '';

  const refId = s(d.affiliate_ref_id);

  return {
    context: {
      currentView,
      fastState: fastStatus,
      reportOpen: reportOpenAt(localMinutes) ? 'open' : 'closed until 8:45pm',
      filedToday: filedToday ? 'yes' : 'no',
      threads,
      profileDigest: `season ${s(profile.season) || 'Building'}; carries ${
        topBurden || 'none'
      }; scripture comfort ${comfort}; tone ${s(profile.tone_pref) || 'standard'}`,
    },
    fastDay,
    fastDuration: duration,
    filedToday,
    bundleName: s(d.bundle_name) || null,
    affiliateLink: refId ? `https://whealthylabel.com?ref=${refId}` : null,
    scriptureComfort: comfort,
    profile,
  };
}

/**
 * Minutes past local midnight from a browser `getTimezoneOffset()` value.
 *
 * This is the one thing the Governor keeps on the steward's own clock, and
 * deliberately so: the 8:45 PM reporting gate at index.html:15359 is
 * `new Date().getHours()`, the hour on the wall in front of him. The calendar
 * day is a different question with a different answer, so it is no longer
 * derived from this offset. It used to be, which meant the Governor compared a
 * device-local date against `entry_date` and `start_date` rows that were written
 * in Chicago, and a steward outside Central time was told he had not filed
 * tonight when he had.
 */
function localMinutesOf(tzOffsetMin: number): number {
  const offset = Number.isFinite(tzOffsetMin) ? Math.max(-840, Math.min(840, tzOffsetMin)) : 0;
  const shifted = new Date(Date.now() - offset * 60000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

const FALLBACK: Dispatch = {
  kind: 'journal',
  href: null,
  message: 'The router did not answer, so I kept your words.',
};

/**
 * Classify one utterance and decide what happens. The action never performs
 * the effect; the dock does, so a navigation stays a client transition and a
 * journal entry reuses the record's own tested write path.
 */
export async function governSpeech(
  transcript: string,
  surface: 'governor' | 'record',
  currentView: string,
  tzOffsetMin: number,
): Promise<GovernorTurn> {
  const text = transcript.trim().slice(0, 4000);
  // Two clocks, two questions. What day is it: Chicago, the calendar every row
  // in this app is dated in. What time is it: the steward's own, which is what
  // the evening gate has always judged by.
  const todayIso = chicagoToday();
  const localMinutes = localMinutesOf(tzOffsetMin);

  if (!text) {
    return {
      ok: false,
      intent: 'unknown',
      dispatch: { kind: 'speak', href: null, message: 'Say it and I will keep it.' },
      scriptureRef: '',
      scriptureComfort: 1,
    };
  }

  const snap = await snapshot(currentView.slice(0, 40), todayIso, localMinutes);
  const call = await askGovernor('intent_router', buildRouterPrompt(text, snap.context));

  // The live app fell through to fileEntry on a router error. Same promise
  // here: a Governor that cannot classify still keeps the record.
  if (!call.ok) {
    return {
      ok: false,
      intent: 'journal_entry',
      dispatch: FALLBACK,
      scriptureRef: '',
      scriptureComfort: snap.scriptureComfort,
    };
  }

  const intent = coerceForSurface(parseIntent(call.out), surface, snap.context.currentView);
  const dispatch = planDispatch({
    intent,
    todayIso,
    localMinutes,
    fastDay: snap.fastDay,
    fastDuration: snap.fastDuration,
    filedToday: snap.filedToday,
    bundleName: snap.bundleName,
    affiliateLink: snap.affiliateLink,
  });

  return {
    ok: true,
    intent: intent.intent,
    dispatch,
    scriptureRef: intent.scriptureRef,
    scriptureComfort: snap.scriptureComfort,
  };
}

/**
 * The living portrait. Fired after the action lands so it never sits in front
 * of the steward's latency, and deliberately silent on failure: a portrait
 * that did not update is not an error worth surfacing.
 *
 * The live app checked `data.ok` but the 403 and 400 paths of governor-state
 * return no `ok` field at all, so an unapproved or rate limited member saw a
 * silent success. Here the call result is checked before the write is trusted.
 */
export async function learnFromSpeech(
  transcript: string,
  intent: string,
  speakBack: string,
): Promise<{ ok: boolean }> {
  const text = transcript.trim().slice(0, 2000);
  if (!text) return { ok: false };

  const delta = await askGovernor(
    'profile_update',
    [
      'Update the living portrait of this WHEALTHY steward.',
      'Latest interaction:',
      `- Transcript: "${text}"`,
      `- Classified intent: "${intent}"`,
      `- Spoken reply: "${speakBack}"`,
      '',
      'Return ONLY the JSON profile delta.',
    ].join('\n'),
  );
  if (!delta.ok || typeof delta.out !== 'object' || delta.out === null) return { ok: false };

  const save = await memberFn('governor-state', { action: 'save_profile', delta: delta.out });
  return { ok: save.ok && save.data.ok === true };
}
