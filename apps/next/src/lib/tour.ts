import { cache } from 'react';
import { getPublicEnv } from '@/lib/env';

/**
 * The seven First Steps keys, in the order the live app renders them.
 * `tour-state` whitelists exactly these server-side, so anything else in a
 * payload is dropped rather than stored.
 */
export const FS_KEYS = ['bundle', 'word', 'wall', 'record', 'community', 'fast', 'code'] as const;

export type FsKey = (typeof FS_KEYS)[number];

/**
 * Route path to First Step key. The live app completed a step purely by
 * navigation (`reportFirstStepVisit(view)` called from inside `go()`), and the
 * stored flags are append-only, so the port keeps the same trigger: arriving
 * in the room checks the box.
 */
export const FS_ROUTE_MAP: Readonly<Record<string, FsKey>> = {
  '/claim': 'bundle',
  '/bible': 'word',
  '/wall': 'wall',
  '/record': 'record',
  '/community': 'community',
  '/fast': 'fast',
  '/affiliate': 'code',
};

/** Resolve a pathname to the step it completes, ignoring nested segments. */
export function stepForPath(pathname: string): FsKey | null {
  if (typeof pathname !== 'string') return null;
  const first = pathname.split('?')[0]!.split('/').filter(Boolean)[0];
  if (!first) return null;
  return FS_ROUTE_MAP[`/${first}`] ?? null;
}

export interface MemberProfile {
  email: string;
  /** True only when `verify-member` found the row. */
  verified: boolean;
  /**
   * `approved_members.id`, the numeric key the wall family writes against.
   * Null when the row was not found, so callers can refuse rather than guess.
   */
  memberId: number | null;
  name: string;
  firstName: string;
  archetype: string | null;
  archetypeName: string;
  identityAnchor: string | null;
  memberStatus: string | null;
  adminRole: string | null;
  tourDoneAt: string | null;
  firstSteps: Record<string, boolean>;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/** Title-case a slug or snake/kebab archetype key for display. */
export function prettyArchetype(raw: string | null): string {
  const s = str(raw);
  if (!s) return 'Steward';
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Coerce whatever `verify-member` reports as `id` into a usable numeric key. */
function memberIdOf(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * Read the `verify-member` payload. Pure, so the mapping is pinned by
 * fixtures taken from the deployed function.
 *
 * This is the app's ONLY authoritative read of the member row, and it has to
 * be: `approved_members` has row level security on with no SELECT policy and
 * no grant to the `authenticated` role, so a session-scoped
 * `.from('approved_members').select(...)` raises "permission denied" for every
 * signed-in user, Ignacio included. `verify-member` runs on the service role
 * and is the same door the legacy app used (index.html:12491), so everything
 * that needs the row, the admin role and the numeric member id included, comes
 * through here.
 *
 * Three fields matter beyond identity: `id`, the key the wall family writes
 * against, `first_steps`, the jsonb map that is the only real source of
 * checklist progress, and `tour_done_at`, which decides whether the guided
 * tour offers itself.
 */
export function parseMemberProfile(raw: unknown, fallbackEmail: string): MemberProfile {
  const d = (raw ?? {}) as Record<string, unknown>;
  const name = str(d.name) ?? 'Steward';
  const rawSteps = d.first_steps;
  const firstSteps: Record<string, boolean> = {};
  if (rawSteps && typeof rawSteps === 'object' && !Array.isArray(rawSteps)) {
    for (const [k, v] of Object.entries(rawSteps as Record<string, unknown>)) {
      if (v === true) firstSteps[k] = true;
    }
  }
  const first = name.split(/\s+/)[0] ?? 'Steward';
  return {
    email: str(d.email) ?? fallbackEmail,
    verified: d.verified === true,
    memberId: memberIdOf(d.id),
    name,
    firstName: first.charAt(0).toUpperCase() + first.slice(1),
    archetype: str(d.archetype),
    archetypeName: prettyArchetype(str(d.archetype_name) ?? str(d.archetype)),
    identityAnchor: str(d.identity_anchor),
    memberStatus: str(d.member_status),
    adminRole: str(d.admin_role),
    tourDoneAt: str(d.tour_done_at),
    firstSteps,
  };
}

/** What the app falls back to when `verify-member` is unreachable. */
export function emptyProfile(email: string): MemberProfile {
  return parseMemberProfile({}, email);
}

/**
 * Fetch the member profile. `verify-member` is deliberately unauthenticated
 * and takes a plain `{ email }` body; the email here is always the validated
 * session email, never client input. Cached per request so the layout, the
 * dashboard and the tour mount share one round trip.
 */
export const fetchMemberProfile = cache(async (email: string): Promise<MemberProfile> => {
  const env = getPublicEnv();
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_FN_BASE}/verify-member`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return emptyProfile(email);
    return parseMemberProfile(await res.json(), email);
  } catch {
    return emptyProfile(email);
  }
});

/** Parse what `tour-state` returns after a write. */
export function parseTourStateResult(raw: unknown): {
  tourDoneAt: string | null;
  firstSteps: Record<string, boolean>;
} {
  const p = parseMemberProfile(raw ?? {}, '');
  return { tourDoneAt: p.tourDoneAt, firstSteps: p.firstSteps };
}

export interface TourStep {
  /** The sidebar destination to spotlight, or null for a centered card. */
  target: string | null;
  title: string;
  body: string;
  nextLabel?: string;
  skipLabel?: string | null;
  adminOnly?: boolean;
}

export interface TourContext {
  firstName: string;
  archetypeName: string;
  bundleClaimed: boolean;
  fastActive: boolean;
  fastDay: number;
  fastDuration: number;
  isAdmin: boolean;
  wordDay: string;
  firstUnchecked: string;
}

/** Labels used by the finish card, matching the live checklist wording. */
export const FS_TOUR_LABELS: Readonly<Record<FsKey, string>> = {
  bundle: 'Claim your monthly bundle',
  word: "Open today's Word",
  wall: 'Lift one prayer on the Wall',
  record: "File tonight's journal entry",
  community: 'Step into the Community',
  fast: 'Start your fast',
  code: 'Grab your 10% member code',
};

/** The first step the member has not completed, for the finish card. */
export function firstUncheckedLabel(flags: Record<string, boolean> | undefined): string {
  const f = flags ?? {};
  for (const key of FS_KEYS) {
    if (!f[key]) return FS_TOUR_LABELS[key];
  }
  return FS_TOUR_LABELS.bundle;
}

/**
 * The guided tour, one card per room. Ported from `buildSteps()` with two
 * deliberate changes: My Rhythm is included because it did not exist when the
 * tour was written, and the "Enter Community" step is dropped because the
 * Skool hand-off is no longer a sidebar destination.
 */
export function buildTourSteps(st: TourContext): TourStep[] {
  const steps: TourStep[] = [
    {
      target: null,
      title: `${st.archetypeName}.`,
      body: `That's what the assessment named you, ${st.firstName}. This house was built for stewards who carry real weight. Every room, ninety seconds. Walk with me.`,
      nextLabel: 'Walk me through',
      skipLabel: 'I know the house',
    },
    {
      target: '/',
      title: 'Home',
      body: 'Your command center. Every morning starts here: the Daily Directive, one line that governs the day, and your bundle at hand.',
    },
    {
      target: '/rhythm',
      title: 'My Rhythm',
      body: 'The daily anchors you actually run. Built around your chronotype and your season, and it moves when your season moves.',
    },
    {
      target: '/claim',
      title: 'Claim Bundle',
      body: st.bundleClaimed
        ? 'Your bundle is claimed. This room is where next month’s drop gets confirmed.'
        : 'Your monthly bundle is waiting. Claim it when we finish and it ships to your door.',
    },
    {
      target: '/tryall',
      title: 'Try All',
      body: 'Every routine in the house, open to try. When your season changes, this is where you re-match.',
    },
    {
      target: '/record',
      title: 'My Journal',
      body: 'Tonight’s entry lives here. What happened, what it weighed, what got burned. Your journal holds it so you don’t have to.',
    },
    {
      target: '/community',
      title: 'Community',
      body: 'The feed. Real posts from inside the community without leaving the app, and the full house on Skool one click away.',
    },
    {
      target: '/prayer',
      title: 'Prayer',
      body: 'Discipline one. Guided morning and evening petitions that meet you where you are.',
    },
    {
      target: '/wall',
      title: 'Prayer Wall',
      body: 'Carry someone. Real weight from real stewards lands here, you amen it, you lift it, you add your own. Nobody on this wall carries alone.',
    },
    {
      target: '/testimony',
      title: 'Testimony Wall',
      body: 'Answered weight gets witnessed. When God moves, it lands here.',
    },
    {
      target: '/me',
      title: 'My Prayers',
      body: 'Everything you’ve lifted, kept. Return, update, close the loop.',
    },
    {
      target: '/bible',
      title: 'Scripture',
      body: `The Word, daily.${st.wordDay ? ` You’re on Day ${st.wordDay}.` : ''} The reading meets your season.`,
    },
    {
      target: '/fast',
      title: 'The Fast',
      body: st.fastActive
        ? `Day ${st.fastDay} of ${st.fastDuration}. Tonight’s report is waiting.`
        : 'When you’re ready to lay something down, it starts here. A model, rules, and a clock.',
    },
    {
      target: '/cohort',
      title: 'Cohort Challenge',
      body: 'Fast together. Cohorts run one shared clock, and the board shows who’s standing.',
    },
    {
      target: '/circle',
      title: 'Circles',
      body: 'Your circle: a handful of stewards, a daily pulse. The smallest room in the house and the strongest.',
    },
    {
      target: '/affiliate',
      title: 'Affiliate Center',
      body: 'Your 10% member code lives here, plus your share link. Carry the mission forward, get paid when it lands.',
    },
    {
      target: '/portal',
      title: 'Product Portal',
      body: 'Orders, shipments, subscriptions. The logistics room.',
    },
    {
      target: '/admin',
      title: 'Admin',
      body: 'The master key, and only you see it. Surface holds cohorts, the roster, moderation, and settings. Control Panel is your live analytics.',
      adminOnly: true,
    },
    {
      target: null,
      title: 'The House',
      body: `That’s the house, ${st.firstName}. Your First Steps are on Home. Start with ${st.firstUnchecked}. Govern the day.`,
      nextLabel: 'Start my First Steps',
      skipLabel: null,
    },
  ];
  return st.isAdmin ? steps : steps.filter((s) => !s.adminOnly);
}
