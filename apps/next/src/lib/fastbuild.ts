/**
 * The Fast builder, ported from the live app's wizard (index.html
 * "FAST BUILDER" region) as pure functions so every rule is testable.
 *
 * Nothing in here talks to the network. The wizard collects a `WizardState`,
 * `buildFallbackPlan` produces a complete plan with no AI at all, and
 * `composeFastRow` emits the exact `fasts` row shape the legacy app writes so
 * a fast built here keeps rendering in the current app until cutover.
 */

/* ================== CHOICE LIBRARIES ================== */

export interface LayGroup {
  label: string;
  items: string[];
}

export const LAY_GROUPS: LayGroup[] = [
  { label: 'Drinks', items: ['Soft drinks', 'Alcohol', 'Coffee', 'Energy drinks', 'Sugary drinks'] },
  { label: 'Food patterns', items: ['Sugar', 'Fast food', 'Eating after 8pm', 'Snacking'] },
  { label: 'Screens', items: ['Social media', 'Streaming', 'News', 'Gaming'] },
  { label: 'Habits', items: ['The snooze button', 'Complaining', 'Impulse spending'] },
];

export type WhyKey =
  | 'freedom'
  | 'direction'
  | 'nearness'
  | 'intercession'
  | 'repentance'
  | 'preparation';

export const WHYS: { key: WhyKey; label: string }[] = [
  { key: 'freedom', label: 'Breaking something that owns me' },
  { key: 'direction', label: 'Seeking direction on a decision' },
  { key: 'nearness', label: 'Drawing near in a heavy season' },
  { key: 'intercession', label: 'Standing in for someone specific' },
  { key: 'repentance', label: 'Repentance and reset' },
  { key: 'preparation', label: 'Preparing for what is coming' },
];

export const WHY_LABEL: Record<string, string> = {
  freedom: 'breaking what owns you',
  direction: 'seeking direction',
  nearness: 'drawing near',
  intercession: 'standing in for someone',
  repentance: 'repentance and reset',
  preparation: 'preparing for what is coming',
};

/** A free-text entry naming total food abstention: allowed, but structure only. */
export const FOOD_ABSTAIN = /\b(no food|all food|water only|nothing but water|total fast|full fast|starv)/i;
/** A free-text entry that makes this a diet: rejected outright. */
export const WEIGHT_RX = /\b(weight|pounds|lbs|fat|slim|skinny|calories|diet)\b/i;

export type FreeGuard = 'weight' | 'food' | null;

/** Classify a free-text lay-down entry. 'weight' entries are never added. */
export function guardFreeText(text: string): FreeGuard {
  if (WEIGHT_RX.test(text)) return 'weight';
  if (FOOD_ABSTAIN.test(text)) return 'food';
  return null;
}

/**
 * The guard cards. Split into lead and body so the lead can carry the
 * emphasis the live app gives it, with the shipped wording verbatim rather
 * than a shortened paraphrase.
 */
export const GUARD_COPY: Record<'weight' | 'food', { lead: string; body: string }> = {
  weight: {
    lead: 'This is a fast, not a diet.',
    body: 'If the goal is the body, this is the wrong tool. Name what owns your attention instead, and we will build around that.',
  },
  food: {
    lead: 'A full food fast is between you, your doctor, and your pastor.',
    body: 'We will structure everything around it, the prayer, the scripture, the schedule, the journal. The dietary decision itself stays yours and theirs.',
  },
};

export const ATTACH_CATEGORIES = [
  'marriage',
  'children',
  'finances',
  'health',
  'work',
  'temptation',
  'other',
];

/* ================== SCRIPTURE LIBRARY ================== */

export const LIB = {
  constants: {
    open: 'Matthew 6:16-18',
    renewal: 'Romans 12:1-2',
    close: ['2 Timothy 4:7', 'Psalm 118:24'],
  },
  why: {
    freedom: ['1 Corinthians 6:12', 'Galatians 5:1', 'Psalm 118:5', 'Romans 6:14', 'John 8:36'],
    direction: ['James 1:5', 'Psalm 25:4-5', 'Proverbs 3:5-6', 'Isaiah 30:21', 'Psalm 32:8'],
    nearness: ['Psalm 46:1', 'Matthew 11:28-30', 'Isaiah 40:31', 'Psalm 62:5-8', 'James 4:8'],
    intercession: [
      'Esther 4:16',
      'Nehemiah 1:4',
      'Colossians 4:2',
      'James 5:16',
      '1 Timothy 2:1',
    ],
    repentance: ['Joel 2:12-13', 'Psalm 51:10', '1 John 1:9', 'Ephesians 4:22-24', 'Psalm 32:5'],
    preparation: [
      'Luke 16:10',
      'Joshua 1:9',
      'Proverbs 16:3',
      'Habakkuk 2:2-3',
      '1 Peter 1:13',
    ],
  } as Record<string, string[]>,
  themes: {
    Commitment: ['Psalm 37:5', 'Matthew 6:16-18'],
    'Self Control': ['1 Corinthians 9:24-27', 'Galatians 5:22-23'],
    Perseverance: ['James 1:2-4', 'Isaiah 40:31'],
    Renewal: ['Romans 12:1-2', 'Psalm 51:10'],
    Strength: ['Philippians 4:13', 'Psalm 46:1'],
    Faithfulness: ['Luke 16:10', 'Lamentations 3:22-23'],
    Victory: ['2 Timothy 4:7', 'Psalm 118:24'],
  } as Record<string, string[]>,
};

/* ================== BIBLICAL FASTS LIBRARY ================== */

export interface FastPattern {
  id: string;
  figure: string;
  title: string;
  refs: string[];
  days: number;
  whys: WhyKey[];
  pattern: string;
  line: string;
}

export const FASTS: FastPattern[] = [
  {
    id: 'esther',
    figure: 'Esther',
    title: 'The Fast of Esther',
    refs: ['Esther 4:16'],
    days: 3,
    whys: ['intercession', 'direction'],
    pattern:
      'Three days, set apart before a decision that carried lives. Sought for favor and deliverance.',
    line: 'Your fast follows the pattern of Esther. Three days, set apart before a weight that cannot be carried alone.',
  },
  {
    id: 'daniel-discipline',
    figure: 'Daniel',
    title: "Daniel's Discipline",
    refs: ['Daniel 1:8-16'],
    days: 10,
    whys: ['freedom', 'repentance'],
    pattern:
      'He refused the king’s rich food to stay set apart in a place built to compromise him.',
    line: 'Your fast follows the pattern of Daniel’s discipline. Refusing what the table offers to stay set apart.',
  },
  {
    id: 'daniel-mourning',
    figure: 'Daniel',
    title: "Daniel's 21 Days",
    refs: ['Daniel 10:2-3'],
    days: 21,
    whys: ['direction', 'nearness'],
    pattern:
      'Twenty-one days of plain food while he waited on an answer that was delayed but coming.',
    line: 'Your fast follows the pattern of Daniel’s 21 days. Seeking an answer that has not arrived yet, and not letting go.',
  },
  {
    id: 'wilderness',
    figure: 'the wilderness',
    title: 'The Wilderness Fast',
    refs: ['Matthew 4:1-2', 'Exodus 34:28', '1 Kings 19:8'],
    days: 40,
    whys: ['preparation'],
    pattern: 'Forty days of consecration before a calling. Moses, Elijah, and Christ each walked it.',
    line: 'Your fast follows the pattern of the wilderness. Forty days of preparation before what is coming.',
  },
  {
    id: 'david',
    figure: 'David',
    title: "David's Intercession",
    refs: ['2 Samuel 12:16-23'],
    days: 7,
    whys: ['intercession', 'nearness'],
    pattern:
      'He fasted and lay on the ground pleading for another life. Grief poured out before God.',
    line: 'Your fast follows the pattern of David. Standing in the gap for someone you cannot fix yourself.',
  },
  {
    id: 'nehemiah',
    figure: 'Nehemiah',
    title: "Nehemiah's Fast",
    refs: ['Nehemiah 1:4'],
    days: 7,
    whys: ['repentance', 'preparation'],
    pattern: 'He wept and fasted over what was broken before he ever lifted a stone to rebuild.',
    line: 'Your fast follows the pattern of Nehemiah. Repentance and readiness before the rebuild.',
  },
  {
    id: 'joel',
    figure: 'Joel',
    title: 'The Return',
    refs: ['Joel 2:12-13'],
    days: 7,
    whys: ['repentance'],
    pattern: 'Return to me with all your heart. A turning back, whole and deliberate.',
    line: 'Your fast follows the call of Joel. A full turning back, with nothing held.',
  },
  {
    id: 'nineveh',
    figure: 'Nineveh',
    title: 'The Turning',
    refs: ['Jonah 3:5-10'],
    days: 3,
    whys: ['repentance', 'freedom'],
    pattern:
      'A city turned from what it was doing, and God relented. Repentance that changed a course.',
    line: 'Your fast follows the turning of Nineveh. Turning hard from one thing, fully.',
  },
  {
    id: 'anna',
    figure: 'Anna',
    title: "Anna's Devotion",
    refs: ['Luke 2:37'],
    days: 7,
    whys: ['nearness'],
    pattern: 'Worship night and day for years. Nearness not as crisis but as a way of living.',
    line: 'Your fast follows the pattern of Anna. Drawing near, not to escape a season, but to dwell.',
  },
];

export function allRefs(): Set<string> {
  const s = new Set<string>([LIB.constants.open, LIB.constants.renewal, ...LIB.constants.close]);
  for (const a of Object.values(LIB.why)) for (const r of a) s.add(r);
  for (const a of Object.values(LIB.themes)) for (const r of a) s.add(r);
  for (const f of FASTS) for (const r of f.refs) s.add(r);
  return s;
}

export function validRef(r: unknown): boolean {
  return typeof r === 'string' && allRefs().has(r);
}

/** The whitelist handed to governor-ai for the scripture task. */
export function scriptureWhitelist(): string[] {
  return [
    LIB.constants.open,
    ...LIB.constants.close,
    ...Object.values(LIB.why).flat(),
    ...Object.values(LIB.themes).flat(),
  ];
}

export function findPattern(id: string | null): FastPattern | null {
  if (!id) return null;
  return FASTS.find((f) => f.id === id) ?? null;
}

/* ================== MATCHING ================== */

export interface FastHistoryRow {
  model: string;
  duration: number | null;
  ended_day: number | null;
  finished: boolean;
  weak_rule: string | null;
}

export type Experience = 'never' | 'few' | 'life';

/**
 * Score fasts against selected whys. Formula, unchanged from the live app:
 *   +3    the fast's PRIMARY why (first listed) is selected
 *   +1.5  each secondary why selected
 *   +1    exact fit: every why the fast carries is in the selection
 * Experience and history modifiers apply ONLY to fasts with real why
 * relevance, so irrelevant patterns never enter the pool:
 *   never fasted: -3 on 40 day patterns, +0.75 toward 7 days or fewer
 *   last fast unfinished: -1 on patterns at least double the day reached
 */
export function matchFast(
  whys: string[],
  exp: Experience | null,
  lastFast: FastHistoryRow | null,
): { primary: FastPattern; alt: FastPattern | null } {
  let scored = FASTS.map((f) => {
    let s = 0;
    f.whys.forEach((w, i) => {
      if (whys.includes(w)) s += i === 0 ? 3 : 1.5;
    });
    if (s === 0) return { f, s: 0 };
    if (f.whys.every((w) => whys.includes(w))) s += 1;
    if (exp === 'never' && f.days >= 40) s -= 3;
    if (exp === 'never' && f.days <= 7) s += 0.75;
    if (
      lastFast &&
      !lastFast.finished &&
      typeof lastFast.ended_day === 'number' &&
      lastFast.ended_day > 1 &&
      f.days >= lastFast.ended_day * 2
    ) {
      s -= 1;
    }
    return { f, s };
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (scored.length === 0) {
    const fallback = FASTS.find((x) => x.id === 'daniel-mourning') ?? FASTS[2]!;
    scored = [{ f: fallback, s: 1 }];
  }
  return { primary: scored[0]!.f, alt: scored[1] ? scored[1].f : null };
}

/**
 * Why the recommended pattern won over the runner-up. The live app names the
 * alternate, then says plainly which why decided it, so the recommendation
 * reads as a judgement rather than a shuffle.
 */
export function altLine(alt: FastPattern, primary: FastPattern, primaryWhy: string): string {
  const why = WHY_LABEL[primaryWhy] ?? primaryWhy;
  return `${alt.title} also fit what you carry. But you marked ${why} first, and ${primary.figure}'s pattern holds ${primary.days} days for exactly that.`;
}

/** The honest read when the previous fast did not reach its last day. */
export function unfinishedLine(lastFast: FastHistoryRow | null): string | null {
  if (!lastFast || lastFast.finished || typeof lastFast.ended_day !== 'number') return null;
  const rule = lastFast.weak_rule
    ? ` on ${lastFast.weak_rule.toLowerCase().replace(/\.$/, '')}`
    : '';
  return `Your last fast closed at Day ${lastFast.ended_day}${rule}. The pattern stays scriptural. The rhythm ahead accounts for what broke.`;
}

/* ================== PHASES AND FORMATTING ================== */

export interface Phase {
  name: string;
  from: number;
  to: number;
  theme: string;
}

/**
 * Drop any phase that starts past the final day and pull the last one out to
 * meet it. The live app skips this, so an 8 day fast renders a phase reading
 * "Days 9 to 8" with no days in it. Every range is now contiguous and
 * finishes exactly on the final day.
 */
function normalizePhases(phases: Phase[], n: number): Phase[] {
  const kept = phases
    .filter((p) => p.from <= n)
    .map((p) => ({ ...p, to: Math.min(p.to, n) }));
  if (kept.length === 0) return [{ name: 'Set Apart', from: 1, to: n, theme: 'Commitment' }];
  const last = kept[kept.length - 1]!;
  return [...kept.slice(0, -1), { ...last, to: n }];
}

export function phaseRanges(n: number): Phase[] {
  if (n === 3) return [{ name: 'Set Apart', from: 1, to: 3, theme: 'Commitment' }];
  if (n <= 7) {
    return normalizePhases(
      [
        { name: 'Foundation', from: 1, to: Math.ceil(n / 2) + 1, theme: 'Commitment' },
        { name: 'Finish Strong', from: Math.ceil(n / 2) + 2, to: n, theme: 'Victory' },
      ],
      n,
    );
  }
  if (n <= 10) {
    return normalizePhases(
      [
        { name: 'Foundation', from: 1, to: 4, theme: 'Commitment' },
        { name: 'Discipline', from: 5, to: 8, theme: 'Self Control' },
        { name: 'Finish Strong', from: 9, to: n, theme: 'Victory' },
      ],
      n,
    );
  }
  if (n <= 21) {
    return normalizePhases(
      [
        { name: 'Foundation', from: 1, to: 7, theme: 'Commitment' },
        { name: 'Discipline', from: 8, to: 14, theme: 'Perseverance' },
        { name: 'Breakthrough', from: 15, to: n, theme: 'Renewal' },
      ],
      n,
    );
  }
  return normalizePhases(
    [
      { name: 'Foundation', from: 1, to: 10, theme: 'Commitment' },
      { name: 'Discipline', from: 11, to: 20, theme: 'Self Control' },
      { name: 'Breakthrough', from: 21, to: 30, theme: 'Renewal' },
      { name: 'Finish Strong', from: 31, to: n, theme: 'Faithfulness' },
    ],
    n,
  );
}

export function fmtTime(t: string): string {
  const parts = t.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
  const ap = h >= 12 ? 'pm' : 'am';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')}${ap}`;
}

/** "Jul 22" from a plain YYYY-MM-DD day key, read as a local calendar date. */
export function niceDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** The last day of a fast, as a day key. */
export function endDayKey(startIso: string, duration: number): string {
  const d = new Date(`${startIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return startIso;
  d.setDate(d.getDate() + duration - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ================== ANCHORS ================== */

export interface FastAnchors {
  wake: string;
  lights: string;
  oz: number;
  movement: boolean;
  laps: number;
  journal: number;
  prayer: boolean;
}

export const DEFAULT_ANCHORS: FastAnchors = {
  wake: '06:40',
  lights: '22:00',
  oz: 128,
  movement: true,
  laps: 2,
  journal: 5,
  prayer: true,
};

export interface AnchorReasons {
  wake: string;
  lights: string;
  oz: string;
}

/**
 * Opening anchor recommendation. Record consent moves lights out later and
 * says why; a fast that broke on lights out last time starts later still and
 * earns its way down.
 */
export function recommendAnchors(
  recordConsent: boolean,
  lastFast: FastHistoryRow | null,
  equipped: boolean,
): { anchors: FastAnchors; reasons: AnchorReasons } {
  let lights = recordConsent ? '22:30' : '22:00';
  let lightsWhy = recordConsent
    ? 'Your record runs near 11pm. 10:30 is the honest first step, not a fantasy.'
    : 'Protects the afternoon your pattern loses.';
  if (lastFast && lastFast.weak_rule && /lights out/i.test(lastFast.weak_rule)) {
    lights = '22:45';
    lightsWhy =
      'Your last fast broke on lights out. This one starts fifteen minutes later and earns its way down.';
  }
  return {
    anchors: { ...DEFAULT_ANCHORS, lights },
    reasons: {
      lights: lightsWhy,
      oz: equipped
        ? 'Your Hydration routine counts toward this gallon.'
        : 'A gallon, water and any hydration combined.',
      wake: 'Ahead of the day, before it takes the first hour.',
    },
  };
}

/** The anchor commitments that ride along as additions, non-removable. */
export function defaultTakes(anchors: FastAnchors): string[] {
  const takes: string[] = [];
  if (anchors.movement) takes.push('Morning movement');
  if (anchors.laps > 0) takes.push(`Daily walk (${anchors.laps} laps)`);
  if (anchors.journal > 0) takes.push(`Daily journal (${anchors.journal} minutes)`);
  if (anchors.prayer) takes.push('Morning & Night Prayer');
  return takes;
}

/** Products the fast rules out, by name. */
export function computeExclusions(laid: string[], caffScope: string | null): string[] {
  const ex = new Set<string>();
  if (laid.includes('Coffee')) {
    if (caffScope === 'all') {
      ex.add('Genius Joe');
      ex.add('Charge');
    } else {
      ex.add('Genius Joe');
    }
  }
  if (laid.includes('Energy drinks')) ex.add('Charge');
  return [...ex];
}

/* ================== THE PLAN ================== */

export interface ScheduleRow {
  time: string;
  action: string;
}
export interface PrayerWeek {
  week: number;
  theme: string;
  morning: string;
  night: string;
}
export interface PlanPhase extends Phase {
  goal: string;
  milestone: string;
}
export interface FastPlan {
  fast_name: string;
  model_line: string;
  rules: string[];
  daily_schedule: ScheduleRow[];
  phases: PlanPhase[];
  prayer_plan: PrayerWeek[];
  journal_prompts: Record<string, string>;
  focus: Record<string, string[]>;
  after: { keep: string; return: string };
  taking_on: string[];
}

export function rulePhrases(duration: number, caffScope: string | null): Record<string, string> {
  return {
    'The snooze button': `First alarm wins. The snooze button is dead for ${duration} days.`,
    'Social media': 'Social media comes off the phone. It will survive without you.',
    'Energy drinks': `Not one can crosses the ${duration} days.`,
    Coffee:
      caffScope === 'all'
        ? 'No caffeine in any form. The cup stays empty.'
        : 'The coffee stays in the cabinet. Water takes its slot.',
    Alcohol: `Nothing poured, all ${duration} days.`,
    Sugar: 'Sugar is laid down, whole, including where it hides.',
    'Sugary drinks': 'If it is sweet and poured, it waits until after.',
    'Soft drinks': `No soft drinks touch these ${duration} days.`,
    Streaming: 'The shows wait. They will still be there on the other side.',
    News: 'The feed goes quiet. Your record does not.',
    Gaming: 'The controller rests until the final day.',
    'Fast food': 'No drive-through. Food you planned, eaten sitting down.',
    'Eating after 8pm': 'The kitchen closes at 8pm, every night.',
    Snacking: 'Meals, not grazing. Three sit-downs a day.',
    Complaining: 'Complaints go in the journal, not out loud.',
    'Impulse spending': `Nothing unplanned leaves the account for ${duration} days.`,
  };
}

const PHASE_GOAL: Record<string, string> = {
  Foundation: 'Build the routine. Show up, not perfectly, daily.',
  Discipline: 'Win the boring days. The novelty is gone.',
  Breakthrough: 'Hold steady while it becomes normal.',
  'Finish Strong': 'No coasting. Finish like Day 1 mattered.',
};
const PHASE_PROMPT: Record<string, string> = {
  Foundation: 'What was the hardest pull today and how did I answer it?',
  Discipline: 'Where did discipline feel automatic today, and where did it feel like war?',
  Breakthrough: 'What is changing that I could not see on Day 1?',
};

export interface PlanInputs {
  pattern: FastPattern;
  duration: number;
  laid: string[];
  whys: string[];
  caffScope: string | null;
  anchors: FastAnchors;
  takingOn: string[];
  exclusions: string[];
  equipped: boolean;
}

/**
 * The complete plan with no AI involved. `forge` overlays whatever
 * governor-ai returns on top of this, field by field, so a failed or slow
 * generation still yields a full plan.
 */
export function buildFallbackPlan(inp: PlanInputs): FastPlan {
  const { pattern, duration, anchors, laid, whys, caffScope, exclusions, equipped } = inp;
  const phases = phaseRanges(duration);
  const weeks = Math.max(1, Math.ceil(duration / 7));
  const ex = new Set(exclusions);
  const phrases = rulePhrases(duration, caffScope);

  const sched: ScheduleRow[] = [
    { time: fmtTime(anchors.wake), action: 'Wake. Feet on the floor. No snooze.' },
    { time: '+15m', action: 'Morning prayer with this week’s passage.' },
    { time: '+30m', action: `16 oz to start the day. Counts toward your ${anchors.oz} oz.` },
  ];
  if (anchors.movement) {
    sched.push({ time: '+45m', action: 'Morning movement, bodyweight and household items only.' });
  }
  if (anchors.laps) sched.push({ time: 'morning', action: `${anchors.laps} laps, rain or shine.` });
  sched.push({
    time: '12:00pm',
    action: `Hydration check: near ${Math.round(anchors.oz * 0.4)} oz by lunch.`,
  });
  // The live app guards this row with `!ex.has('Genius Guice')`, a typo that
  // never matches an exclusion, so the row always rendered for an equipped
  // member. Parity is kept deliberately: the row names no product, and
  // `filterSchedule` still drops anything an exclusion actually covers.
  if (equipped) {
    sched.push({
      time: '1:30pm',
      action: 'Your afternoon routine sits here, ahead of the window your record names.',
    });
  }
  sched.push({ time: '6:00pm', action: `Hydration near ${Math.round(anchors.oz * 0.8)} oz.` });
  sched.push({
    time: '8:30pm',
    action: `Journal, ${anchors.journal} minutes minimum. File it in The Record.`,
  });
  sched.push({ time: '9:30pm', action: 'Night prayer. Lay down what the day put on you.' });
  sched.push({ time: fmtTime(anchors.lights), action: 'Lights out.' });

  const rules = laid
    .map((l) => phrases[l] ?? `Laid down: ${l.toLowerCase()}. Held for all ${duration} days.`)
    .concat([
      `Lights out by ${fmtTime(anchors.lights)}. The afternoon is won the night before.`,
      `Up by ${fmtTime(anchors.wake)}, ahead of the house.`,
      `${anchors.oz} oz of hydration, paced across the day.`,
      `Journal ${anchors.journal} minutes, filed in The Record.`,
      'Prayer twice, morning and night. The spine holds everything else.',
    ])
    .slice(0, 9);

  const primaryWhy = whys[0] ?? 'nearness';
  const whyRefs = LIB.why[primaryWhy] ?? LIB.why.nearness!;
  const prayerPlan: PrayerWeek[] = [];
  for (let w = 1; w <= weeks; w++) {
    const ph = phases[Math.min(Math.floor(((w - 1) * phases.length) / weeks), phases.length - 1)]!;
    prayerPlan.push({
      week: w,
      theme: ph.theme,
      morning: w === 1 ? LIB.constants.open : (LIB.themes[ph.theme]?.[0] ?? LIB.constants.open),
      night:
        weeks > 1 && w === weeks
          ? LIB.constants.close[0]!
          : whyRefs[(w - 1) % whyRefs.length]!,
    });
  }

  const journalPrompts: Record<string, string> = {};
  const focus: Record<string, string[]> = {};
  for (const p of phases) {
    journalPrompts[p.name] =
      PHASE_PROMPT[p.name] ?? 'What from this fast becomes permanent after the final day?';
    focus[p.name] = [
      'Full routine. No exceptions.',
      'Pace the hydration. Do not chug.',
      'Pray before you scroll.',
      'Show up on the boring day.',
    ];
  }

  return {
    fast_name: pattern.title.toUpperCase(),
    model_line: pattern.line,
    rules,
    daily_schedule: sched,
    phases: phases.map((p) => ({
      ...p,
      goal: PHASE_GOAL[p.name] ?? 'Set apart, fully, for the whole span.',
      milestone: 'Honest scorecard in the journal: every rule, kept or missed, owned.',
    })),
    prayer_plan: prayerPlan,
    journal_prompts: journalPrompts,
    focus,
    after: {
      keep: 'The gallon, the movement, the journal, and prayer twice a day are worth keeping for life.',
      return: ex.size
        ? 'What you laid down may return after the final day. If you choose not to pick it back up, a governed routine exists for that hour. That call is yours, after, not during.'
        : '',
    },
    taking_on: inp.takingOn.slice(),
  };
}

/**
 * Repair whatever the scripture task returned: every reference must be on the
 * whitelist, week 1 morning is fixed, and a one-week fast never uses a
 * closing passage at night because those belong to completion.
 */
export function repairPrayerPlan(
  rows: PrayerWeek[],
  phases: Phase[],
  weeks: number,
  primaryWhy: string,
): PrayerWeek[] {
  const whyRefs = LIB.why[primaryWhy] ?? LIB.why.nearness!;
  return rows.map((w, i) => {
    const phase = phases[Math.min(i, phases.length - 1)]!;
    let morning = w.morning;
    let night = w.night;
    if (!validRef(morning)) {
      morning = i === 0 ? LIB.constants.open : (LIB.themes[phase.theme]?.[0] ?? LIB.constants.open);
    }
    if (!validRef(night)) night = whyRefs[i % whyRefs.length]!;
    if (weeks === 1 && LIB.constants.close.includes(night)) night = whyRefs[0]!;
    return {
      week: typeof w.week === 'number' ? w.week : i + 1,
      theme: typeof w.theme === 'string' && w.theme ? w.theme : phase.theme,
      morning,
      night,
    };
  });
}

/* ================== THE ROW ================== */

export interface WizardState {
  laid: string[];
  caffScope: 'coffee' | 'all' | null;
  whys: string[];
  exp: Experience | null;
  matchedId: string | null;
  altId: string | null;
  dur: number | null;
  start: string | null;
  recordConsent: boolean;
  anchors: FastAnchors;
  carried: 'alone' | 'brother' | 'cohort';
  structureOnly: boolean;
  safetyDiabetic: boolean;
  safetyBP: boolean;
  safetyEating: boolean;
  attachedPrayerId: string | null;
  attachedNewBody: string;
  attachedNewCategory: string;
  takingOn: string[];
  ackAt: string | null;
}

export function initialWizardState(): WizardState {
  return {
    laid: [],
    caffScope: null,
    whys: [],
    exp: null,
    matchedId: null,
    altId: null,
    dur: null,
    start: null,
    recordConsent: false,
    anchors: { ...DEFAULT_ANCHORS },
    carried: 'alone',
    structureOnly: false,
    safetyDiabetic: false,
    safetyBP: false,
    safetyEating: false,
    attachedPrayerId: null,
    attachedNewBody: '',
    attachedNewCategory: '',
    takingOn: [],
    ackAt: null,
  };
}

/**
 * The exact `fasts` row the legacy builder writes, so the current app keeps
 * rendering a fast built here. Two deliberate corrections to the legacy
 * payload, both of which fix silent data loss against the deployed
 * governor-state column allow-list:
 *   - `ack_timestamp` is sent alongside `ack_at`; only the former persists.
 *   - `attached_prayer_body` is mirrored into `plan` since the column does
 *     not exist and the top-level field is dropped.
 */
export function composeFastRow(
  state: WizardState,
  pattern: FastPattern,
  plan: FastPlan,
  opts: {
    productState: string;
    prayerId: string | null;
    attachedPrayerBody: string;
    todayIso: string;
  },
): Record<string, unknown> {
  const exclusions = computeExclusions(state.laid, state.caffScope);
  const startDate = state.start ?? opts.todayIso;
  const ack = state.ackAt ?? null;
  return {
    status: 'revealed',
    whys: state.whys.slice(),
    why: state.whys[0] ?? 'nearness',
    fast_model: {
      id: pattern.id,
      title: pattern.title,
      figure: pattern.figure,
      refs: pattern.refs,
    },
    laid: state.laid.slice(),
    exclusions,
    duration: state.dur ?? pattern.days,
    start_date: startDate,
    anchors: { ...state.anchors },
    carried: state.carried,
    ack_at: ack,
    ack_timestamp: ack,
    product_state: opts.productState,
    structure_only: state.structureOnly,
    lastPhase: null,
    briefs: {},
    prayer_id: opts.prayerId,
    attached_prayer_body: opts.attachedPrayerBody,
    taking_on: state.takingOn.slice(),
    plan: {
      ...plan,
      taking_on: state.takingOn.slice(),
      attached_prayer_body: opts.attachedPrayerBody,
      caff_scope: state.caffScope,
      carried: state.carried,
    },
  };
}

/* ================== CONTEXT LINES FOR THE FORGE ================== */

/**
 * The journal entries the readiness read and the record signals draw on. Only
 * the three fields either one looks at, so a caller can pass its own row type.
 */
export interface RecordEntryLite {
  text: string;
  tone: string;
  burned: boolean;
}

/**
 * An honest read before the build begins: if most of the recent record carried
 * weight, say so and hand the decision back. Never a block, only a warning.
 */
export function readinessRead(entries: RecordEntryLite[]): string | null {
  const recent = entries.filter((e) => !e.burned).slice(-5);
  const heavy = recent.filter(
    (e) => e.tone === 'heavy' || /(crash|empty|heavy|5 hours|five hours|3 AM)/i.test(e.text),
  ).length;
  if (heavy >= 3) {
    return `Your record shows a stacked stretch: ${heavy} of your last ${recent.length} entries carried weight. Esther fasted in a crisis, so a fast now is between you and God. Go in with eyes open.`;
  }
  return null;
}

/**
 * The member facts the plan is written for. Read from the real member_profile
 * row rather than hardcoded, which is what the live app does.
 */
export interface ProfileLite {
  name: string;
  identityProfile: string | null;
  season: string | null;
  archetype: string | null;
  recurringPeople: string[];
  recurringBurdens: string[];
}

export function memberLine(p: ProfileLite): string {
  const bits = [`Member: ${p.name || 'Steward'}`];
  if (p.archetype) bits.push(`energy pattern ${p.archetype}`);
  if (p.identityProfile) bits.push(`profile ${p.identityProfile}`);
  if (p.season) bits.push(`season ${p.season}`);
  return `${bits.join(', ')}.`;
}

/**
 * What the record is allowed to tell the plan. Without consent the line says
 * so plainly, so the model never invents signals it was not given.
 */
export function recordLine(
  consent: boolean,
  p: ProfileLite,
  entries: RecordEntryLite[],
): string {
  if (!consent) return 'No record access.';
  const live = entries.filter((e) => !e.burned);
  if (live.length === 0 && p.recurringBurdens.length === 0 && p.recurringPeople.length === 0) {
    return 'Record access granted, but the record is still empty. Set anchors from the pattern alone.';
  }
  const parts: string[] = ['Record signals (with consent):'];
  const heavy = live.slice(-10).filter((e) => e.tone === 'heavy').length;
  parts.push(`${live.length} live entries, ${heavy} of the last ${Math.min(10, live.length)} heavy.`);
  if (p.recurringBurdens.length > 0) {
    parts.push(`Recurring burdens: ${p.recurringBurdens.slice(0, 3).join('; ')}.`);
  }
  if (p.recurringPeople.length > 0) {
    parts.push(`People he keeps carrying: ${p.recurringPeople.slice(0, 3).join(', ')}.`);
  }
  const excerpts = live
    .slice(-3)
    .map((e) => e.text.replace(/\s+/g, ' ').trim().slice(0, 140))
    .filter((t) => t.length > 0);
  if (excerpts.length > 0) {
    parts.push(`In his own words: ${excerpts.map((t) => `"${t}"`).join(' ')}`);
  }
  return parts.join(' ');
}

/** What the previous fast, if any, should teach the rules and milestones. */
export function historyLine(lastFast: FastHistoryRow | null): string {
  if (!lastFast) return 'First fast on record.';
  const rule = lastFast.weak_rule ? `, the rule that broke: ${lastFast.weak_rule}` : '';
  return `Previous fast: ${lastFast.model} closed at Day ${lastFast.ended_day} of ${lastFast.duration}${rule}. Account for this honestly in the rules and milestones, never with shame.`;
}

/**
 * What the plan may name by product. An unequipped member gets a plan that
 * mentions none, and the fast's own exclusions remove the rest.
 */
export function bundleLine(
  equipped: boolean,
  bundleName: string | null,
  placements: string[],
  exclusions: string[],
): string {
  if (!equipped) return 'No products. The plan mentions none.';
  const ex = new Set(exclusions);
  const allowed = placements.filter((p) => p && !ex.has(p));
  return `Bundle owned: ${bundleName || 'Your Bundle'}. Excluded by the fast: ${
    exclusions.length > 0 ? exclusions.join(', ') : 'none'
  }. Allowed placements: ${allowed.length > 0 ? allowed.join(', ') : 'none'}.`;
}

/** Drop schedule rows the fast's own exclusions rule out. */
export function filterSchedule(rows: ScheduleRow[], exclusions: string[]): ScheduleRow[] {
  const ex = new Set(exclusions);
  return rows.filter((s) => {
    const act = s.action || '';
    if (ex.has('Genius Joe') && (act.includes('Genius Joe') || act.toLowerCase().includes('coffee'))) {
      return false;
    }
    if (ex.has('Charge') && (act.includes('Charge') || act.toLowerCase().includes('energy drink'))) {
      return false;
    }
    return true;
  });
}
