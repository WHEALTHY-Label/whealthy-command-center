/**
 * The discipline ledger: the chain chip strip and the four discipline cards.
 *
 * Deployed `discipline-day` v7 answers a `{ email, from, to }` POST with:
 *
 *   { days:        [{ date, word: bool, prayer: bool, fast: bool|null, record: bool }],
 *     today:       one of those days, for `to`,
 *     last_active: { word, prayer, fast, record } as dates or null,
 *     chains:      { word, prayer, fast, record, rhythm }
 *                    each { current, longest, graced_days: [date] } }
 *
 * `fast` is three-valued on purpose: `null` means no fast was running that
 * day, so the day is neither kept nor missed. The chain arithmetic lives in the
 * function and is not repeated here; the function also forgives the first
 * missed day of each Monday to Sunday week, which is what `graced_days` marks
 * and why a chain can be longer than an unbroken run of kept days.
 *
 * Everything in this file is pure and tested. Nothing reads a clock.
 */

import { addDaysIso, dayName, weekOf } from '@/lib/day';

export type DisciplineKey = 'word' | 'prayer' | 'fast' | 'record';
export type ChainKey = DisciplineKey | 'rhythm';

export const DISCIPLINE_KEYS: readonly DisciplineKey[] = ['word', 'prayer', 'fast', 'record'];

export interface LedgerDay {
  date: string;
  word: boolean;
  prayer: boolean;
  /** `null` when no fast was running, so the day counts neither way. */
  fast: boolean | null;
  record: boolean;
}

export interface Chain {
  current: number;
  longest: number;
  gracedDays: string[];
}

export interface Ledger {
  days: LedgerDay[];
  lastActive: Record<DisciplineKey, string | null>;
  chains: Record<ChainKey, Chain>;
}

const EMPTY_CHAIN: Chain = { current: 0, longest: 0, gracedDays: [] };

export const EMPTY_LEDGER: Ledger = {
  days: [],
  lastActive: { word: null, prayer: null, fast: null, record: null },
  chains: {
    word: EMPTY_CHAIN,
    prayer: EMPTY_CHAIN,
    fast: EMPTY_CHAIN,
    record: EMPTY_CHAIN,
    rhythm: EMPTY_CHAIN,
  },
};

function rec(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function whole(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function dateOrNull(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function parseChain(raw: unknown): Chain {
  const c = rec(raw);
  const graced = Array.isArray(c.graced_days) ? c.graced_days : [];
  return {
    current: whole(c.current),
    longest: whole(c.longest),
    gracedDays: graced.filter((d): d is string => dateOrNull(d) !== null),
  };
}

/** Read the `discipline-day` payload. Tolerant: a missing field is not a lie. */
export function parseLedger(raw: unknown): Ledger {
  const d = rec(raw);
  const rawDays = Array.isArray(d.days) ? d.days : [];
  const days: LedgerDay[] = rawDays
    .map(rec)
    .filter((row) => dateOrNull(row.date) !== null)
    .map((row) => ({
      date: String(row.date),
      word: row.word === true,
      prayer: row.prayer === true,
      // Anything that is not an explicit boolean means no fast that day.
      fast: typeof row.fast === 'boolean' ? row.fast : null,
      record: row.record === true,
    }));

  const la = rec(d.last_active);
  const ch = rec(d.chains);
  return {
    days,
    lastActive: {
      word: dateOrNull(la.word),
      prayer: dateOrNull(la.prayer),
      fast: dateOrNull(la.fast),
      record: dateOrNull(la.record),
    },
    chains: {
      word: parseChain(ch.word),
      prayer: parseChain(ch.prayer),
      fast: parseChain(ch.fast),
      record: parseChain(ch.record),
      rhythm: parseChain(ch.rhythm),
    },
  };
}

/**
 * Whether a discipline was kept on a given day.
 *
 * `rhythm` is not a field on a ledger day: the payload has no per-day rhythm
 * value at all. It is the union of the other four, which is exactly how the
 * function builds `rhythmKeptDates` before computing the rhythm chain, so the
 * dots and the count on the same chip finally describe the same thing.
 *
 * The live app read `entry['rhythm']` straight off the day and got `undefined`
 * every time, so the dashboard's headline chip drew seven empty dots for every
 * steward no matter how faithfully they had kept the week. Display only, no
 * write, so it is fixed here rather than reproduced.
 */
export function keptOn(day: LedgerDay | undefined, key: ChainKey): boolean | null {
  if (!day) return null;
  if (key === 'rhythm') {
    return day.word || day.prayer || day.fast === true || day.record;
  }
  return day[key];
}

export type DotClass = 'filled' | 'graced' | 'missed' | 'dim';

export interface ChipDot {
  date: string;
  cls: DotClass;
  /** The live app printed a G inside a graced dot and nothing in the others. */
  label: string;
}

export interface ChipView {
  current: number;
  longest: number;
  state: string;
  /** The mercy verse only appears on the line that invites a steward back. */
  showVerse: boolean;
  dots: ChipDot[];
}

export const MERCY_REF = 'Lamentations 3:22-23';

const HELD = 'The rhythm held.';
const PICK_UP = 'Pick it back up. His mercies are new in the morning.';

/**
 * The chain chip for one discipline, exactly as `renderChainChip` built it at
 * index.html:12735: the current chain count, a line about where the steward
 * stands, and the seven dots of this Monday to Sunday week.
 *
 * The precedence of the state line is the live app's, in its order: kept today
 * wins, then mercy covering today, then mercy covering yesterday, then a miss
 * on either day, and silence about anything else reads as held. A discipline
 * with no chain data at all returns null and the chip is not drawn.
 */
export function chainChip(ledger: Ledger, key: ChainKey, todayIso: string): ChipView | null {
  const chain = ledger.chains[key];
  const byDate = new Map(ledger.days.map((d) => [d.date, d]));
  const week = weekOf(todayIso);
  if (week.length === 0) return null;

  const graced = new Set(chain.gracedDays);
  const yesterdayIso = addDaysIso(todayIso, -1);
  const todayVal = keptOn(byDate.get(todayIso), key);
  const yesterdayVal = keptOn(byDate.get(yesterdayIso), key);

  let state = HELD;
  let showVerse = false;
  if (todayVal === true) {
    state = HELD;
  } else if (graced.has(todayIso)) {
    state = `Mercy covered ${dayName(todayIso)}.`;
  } else if (graced.has(yesterdayIso)) {
    state = `Mercy covered ${dayName(yesterdayIso)}.`;
  } else if (todayVal === false || yesterdayVal === false) {
    state = PICK_UP;
    showVerse = true;
  }

  const dots: ChipDot[] = week.map((date) => {
    const val = keptOn(byDate.get(date), key);
    if (val === true) return { date, cls: 'filled', label: '' };
    if (graced.has(date)) return { date, cls: 'graced', label: 'G' };
    if (val === false) return { date, cls: 'missed', label: '' };
    return { date, cls: 'dim', label: '' };
  });

  return { current: chain.current, longest: chain.longest, state, showVerse, dots };
}

const COUNT_NAMES = ['Zero', 'One', 'Two', 'Three', 'Four'] as const;

/** How many of the four disciplines were kept today. */
export function keptToday(ledger: Ledger, todayIso: string): number {
  const day = ledger.days.find((d) => d.date === todayIso);
  if (!day) return 0;
  return DISCIPLINE_KEYS.filter((k) => day[k] === true).length;
}

/** "Two of four disciplines kept today", as the live app spelled the number. */
export function keptTodayLine(kept: number): string {
  const n = Number.isFinite(kept) ? Math.min(4, Math.max(0, Math.floor(kept))) : 0;
  return `${COUNT_NAMES[n] ?? 'Zero'} of four disciplines kept today`;
}

export interface QuietState {
  state: 'warm' | 'cooling' | 'quiet';
  /** The live app dimmed a resting card rather than hiding it. */
  opacity: number;
  label: string;
  /** The invitation back, or `''` when the card should say nothing extra. */
  line: string;
}

const FIRST_TIME: Record<DisciplineKey, string> = {
  word: 'The Word is waiting for its first reading.',
  prayer: 'Prayer is waiting for its first petition.',
  fast: 'The Fast is waiting to begin.',
  record: 'The Record is waiting for its first entry.',
};

function invitation(key: DisciplineKey, n: number): string {
  const days = `${n} ${n === 1 ? 'day' : 'days'}`;
  switch (key) {
    case 'word':
      return `The Word has been quiet ${days}. Open today's reading?`;
    case 'prayer':
      return `Prayer has been quiet ${days}. Lift someone up today?`;
    case 'fast':
      return `Your fast report has been quiet ${days}. Mark tonight?`;
    case 'record':
      return `The Record has been quiet ${days}. Want to speak tonight's entry?`;
  }
}

/**
 * How warm a discipline is, from `getQuietDisciplineState` at
 * index.html:13067. Kept today or yesterday is warm and says so; two or three
 * days is cooling and still says when; four or more rests and invites.
 *
 * `fastRunning` gates only the fast card's invitation, because asking a steward
 * to file a fast report when no fast is running is asking for nothing.
 */
export function quietState(
  key: DisciplineKey,
  lastActive: string | null,
  todayIso: string,
  fastRunning: boolean,
): QuietState {
  if (!lastActive) {
    return { state: 'quiet', opacity: 0.4, label: 'Resting', line: FIRST_TIME[key] };
  }

  const t = Date.parse(`${todayIso}T00:00:00Z`);
  const la = Date.parse(`${lastActive}T00:00:00Z`);
  if (Number.isNaN(t) || Number.isNaN(la)) {
    return { state: 'quiet', opacity: 0.4, label: 'Resting', line: FIRST_TIME[key] };
  }
  const quiet = Math.max(0, Math.floor((t - la) / 86400000));
  const noun = key === 'fast' ? 'Last report' : 'Last entry';

  if (quiet <= 1) {
    return {
      state: 'warm',
      opacity: 1,
      label: `${noun}: ${quiet === 0 ? 'today' : 'yesterday'}`,
      line: '',
    };
  }
  if (quiet <= 3) {
    return { state: 'cooling', opacity: 0.6, label: `${noun}: ${quiet} days ago`, line: '' };
  }
  return {
    state: 'quiet',
    opacity: 0.4,
    label: 'Resting',
    line: key === 'fast' && !fastRunning ? '' : invitation(key, quiet),
  };
}

export interface DisciplineCardDef {
  key: DisciplineKey;
  label: string;
  href: string;
}

/** The four cards under the chip, in the live app's order at index.html:15846. */
export const DISCIPLINE_CARDS: readonly DisciplineCardDef[] = [
  { key: 'word', label: 'The Word', href: '/bible' },
  { key: 'prayer', label: 'Prayer', href: '/prayer' },
  { key: 'fast', label: 'The Fast', href: '/fast' },
  { key: 'record', label: 'My Journal', href: '/record' },
];
