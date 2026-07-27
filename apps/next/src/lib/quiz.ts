/**
 * The Steward Pattern assessment.
 *
 * Ported from the standalone `whealthy-quiz.html`. Every rule here is a
 * transcription of `runQuizScoring()`, kept pure so the cascade is pinned by
 * tests rather than re-derived. The answer indices matter more than the copy:
 * the scoring reads positions, not labels.
 */

export type QuizKind = 'single' | 'double' | 'multi' | 'text';

export interface QuizQuestion {
  kind: QuizKind;
  chapter: string;
  q: string;
  opts?: readonly string[];
  /** Part B of a double screen. */
  q2?: string;
  opts2?: readonly string[];
  sub?: string;
  placeholder?: string;
}

/** The eleven screens, ten counted plus the optional reflection. */
export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    kind: 'single',
    chapter: 'THE PATTERN',
    q: 'SOMEWHERE IN YOUR DAY, IS THERE A STRETCH WHERE HARD WORK FEELS EASY?',
    opts: ['Yes, and I know when it hits', 'There used to be', 'Not that I can point to'],
  },
  {
    kind: 'single',
    chapter: 'THE PATTERN',
    q: "WHEN YOU CAN'T GET MOVING, WHICH ONE IS CLOSER TO TRUE?",
    opts: [
      "I know exactly what needs doing. My body won't go.",
      "I'm going. I just can't land on the thing that matters.",
    ],
  },
  {
    kind: 'double',
    chapter: 'THE PATTERN',
    q: 'THINK BACK. DID SOMETHING CHANGE, OR HAS IT JUST BEEN THIS WAY?',
    opts: [
      'Something specific shifted in the last few months',
      'A year or more of this',
      "I couldn't tell you when it started",
    ],
    q2: 'THE LAST TIME YOU GOT REAL REST, A FULL NIGHT OR A FEW DAYS OFF, HOW LONG DID IT LAST?',
    opts2: [
      'I felt like myself again for a good while',
      'One good day, then back to it',
      "It didn't move much",
      "I can't remember the last time I got that",
    ],
  },
  {
    kind: 'single',
    chapter: 'THE PATTERN',
    q: "YOUR FIRST CUP. BE HONEST ABOUT WHAT IT'S DOING.",
    opts: [
      "The day doesn't start until I've had it",
      "I like it. I'd be fine without it.",
      "I don't drink it",
    ],
  },
  {
    kind: 'single',
    chapter: 'THE PATTERN',
    q: 'LAST THING YOU TRIED FOR THIS. WHAT HAPPENED?',
    opts: [
      "Haven't tried anything",
      'Something actually helped',
      'Nothing happened',
      'Worked for a week or two, then stopped',
    ],
  },
  {
    kind: 'single',
    chapter: 'THE LOAD',
    q: "WHO'S LEANING ON YOU RIGHT NOW?",
    opts: [
      'Just me',
      'Me and my partner',
      'Kids at home',
      'A team or crew at work',
      'All of it, honestly',
    ],
  },
  {
    kind: 'single',
    chapter: 'THE LOAD',
    q: 'WHAT SEASON ARE YOU IN?',
    opts: ['Coasting, things are calm', 'Busy but okay', 'Stacked, carrying a lot', 'Underwater'],
  },
  {
    kind: 'single',
    chapter: 'THE INTENT',
    q: 'WHEN YOU THINK ABOUT GETTING THIS RIGHT, WHAT MATTERS MOST?',
    opts: [
      'Performing at a high level at work',
      'Showing up for my family',
      'My faith and my character',
      'All of it, honestly',
    ],
  },
  {
    kind: 'multi',
    chapter: 'THE INTENT',
    q: 'WHICH OF THESE ARE YOU TRYING TO GOVERN BETTER? (PICK ALL)',
    opts: [
      'Energy and body',
      'Focus and work',
      'Faith and character',
      'Family and presence',
      'Money and provision',
    ],
  },
  {
    kind: 'single',
    chapter: 'THE INTENT',
    q: 'LAST ONE. WHAT ARE YOU REALLY LOOKING FOR?',
    opts: [
      'Something that just works for my energy',
      'A routine and a community to change and steward my whole life',
    ],
  },
  {
    kind: 'text',
    chapter: 'REFLECTION',
    q: "ANYTHING ELSE YOU'RE CARRYING RIGHT NOW?",
    sub: 'Optional. Write as much or as little as you like.',
    placeholder: 'What else are you carrying?',
  },
];

/** Screen 1 reveals a follow-up when the member names a peak. */
export const PEAK_BLOCKS = [
  { label: 'Early morning', value: 'early-morning' },
  { label: 'Late morning', value: 'late-morning' },
  { label: 'Midday', value: 'midday' },
  { label: 'Afternoon', value: 'afternoon' },
  { label: 'Evening', value: 'evening' },
] as const;

export const PROGRESS_WIDTHS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 100] as const;

/** The chrome strings, index-driven exactly as the live quiz builds them. */
export function screenChrome(step: number): {
  counter: string;
  button: string;
  chapter: string;
  progress: number;
} {
  return {
    counter: step === 10 ? 'Optional Step' : `Question ${step + 1} of 10`,
    button: step === 10 ? 'See My Pattern' : 'Continue',
    chapter:
      step < 5 ? 'THE PATTERN' : step < 7 ? 'THE LOAD' : step < 10 ? 'THE INTENT' : 'REFLECTION',
    progress: PROGRESS_WIDTHS[step] ?? 100,
  };
}

/**
 * Raw answers, keyed by screen index. `multi` holds an array; `text` a string.
 * Undefined means unanswered, which the cascade treats as "no signal" rather
 * than as a zero.
 */
export interface QuizAnswers {
  shape?: number; // screen 0
  peakBlock?: string; // screen 0 follow-up
  resource?: number; // screen 1
  timescale?: number; // screen 2 part A
  input?: number; // screen 2 part B
  source?: number; // screen 3
  history?: number; // screen 4
  leaning?: number; // screen 5
  season?: number; // screen 6
  matters?: number; // screen 7
  govern?: number[]; // screen 8
  looking?: number; // screen 9
  carrying?: string; // screen 10
}

export type Pattern =
  | 'low-floor'
  | 'morning-dependency'
  | 'energy-without-aim'
  | 'holding-it-together';

export type BundleKey = 'charge' | 'genius-joe' | 'boss' | 'genius-guice';

export const PATTERN_NAMES: Readonly<Record<Pattern, string>> = {
  'morning-dependency': 'The Morning Dependency',
  'energy-without-aim': 'Energy Without Aim',
  'low-floor': 'The Low Floor',
  'holding-it-together': 'Holding It Together',
};

/** Reveal copy: the two-line name and the one-line signature. */
export const PATTERN_REVEAL: Readonly<
  Record<Pattern, { halves: readonly [string, string]; sig: string }>
> = {
  'morning-dependency': {
    halves: ['Morning', 'Dependency'],
    sig: "The first hour of your day doesn't belong to you. It belongs to the cup.",
  },
  'energy-without-aim': {
    halves: ['Energy Without', 'Aim'],
    sig: 'You have plenty of energy. It just never points in one direction.',
  },
  'low-floor': {
    halves: ['The Low', 'Floor'],
    sig: "You're not crashing, just never fully on.",
  },
  'holding-it-together': {
    halves: ['Holding It', 'Together'],
    sig: "Your energy holds, but your reserves don't.",
  },
};

export type LoadSeason = 'building' | 'carrying' | 'stacked';
export type Pathway = 'steward' | 'customer';
export type IdentityProfile =
  | 'operator'
  | 'anchor'
  | 'provider'
  | 'long-haul'
  | 'builder'
  | 'quiet-carrier';

export interface QuizScore {
  pattern: Pattern;
  patternName: string;
  bundleKey: BundleKey;
  pathway: Pathway;
  loadScore: number;
  loadSeason: LoadSeason;
  identityProfile: IdentityProfile;
  peakBlock: string | null;
  skepticalFlag: boolean;
  signals: {
    shape_fires: boolean;
    resource_fires: boolean;
    timescale_fires: boolean;
    input_fires: boolean;
    source_fires: boolean;
    floorCount: number;
  };
}

/**
 * The three-gate cascade. First gate to open wins; nothing later can override
 * it. Note that `input === 3` ("can't remember") is an UNKNOWN, not a severity
 * signal, so it deliberately fires no gate.
 */
export function runQuizScoring(a: QuizAnswers): QuizScore {
  const shape = a.shape;
  const resource = a.resource;
  const timescale = a.timescale;
  const input = a.input;
  const source = a.source;
  const history = a.history;
  const leaning = a.leaning;
  const season = a.season;
  const matters = a.matters;
  const govern = a.govern ?? [];
  const looking = a.looking;
  const peakBlock = a.peakBlock ?? null;

  let pattern: Pattern;
  let bundleKey: BundleKey;

  // Gate 1, the floor: a diminished shape plus at least two corroborating
  // severity signals.
  const floorSignals =
    (resource === 0 ? 1 : 0) +
    (timescale === 1 || timescale === 2 ? 1 : 0) +
    (input === 1 || input === 2 ? 1 : 0);

  if ((shape === 1 || shape === 2) && floorSignals >= 2) {
    pattern = 'low-floor';
    bundleKey = 'charge';
  } else if (source === 0) {
    // Gate 2, the source: the day does not start without the cup.
    pattern = 'morning-dependency';
    bundleKey = 'genius-joe';
  } else if (peakBlock) {
    // Gate 3, the spend: there is a peak, so the question is where it goes.
    pattern = 'energy-without-aim';
    bundleKey = peakBlock === 'early-morning' || peakBlock === 'late-morning' ? 'boss' : 'genius-guice';
  } else {
    pattern = 'holding-it-together';
    bundleKey = 'boss';
  }

  // Season drives the label; note only index 1 is "carrying", and both 2 and
  // 3 collapse to "stacked".
  const loadSeason: LoadSeason =
    season === 1 ? 'carrying' : season === 2 || season === 3 ? 'stacked' : 'building';

  // The live weights fall back to 1, not 0, on an unanswered screen.
  const leaningWeights = [1, 2, 3, 3, 4];
  const seasonWeights = [1, 2, 3, 4];
  const loadScore =
    (leaning === undefined ? 1 : (leaningWeights[leaning] ?? 1)) +
    (season === undefined ? 1 : (seasonWeights[season] ?? 1));

  // The steward signal comes from what matters most (anything but "work") or
  // from naming faith, family or provision as something to govern.
  const hasStewardSignal =
    matters === 1 ||
    matters === 2 ||
    matters === 3 ||
    govern.includes(2) ||
    govern.includes(3) ||
    govern.includes(4);
  const pathway: Pathway =
    looking === 1 ? 'steward' : looking === 0 ? 'customer' : hasStewardSignal ? 'steward' : 'customer';

  const identityProfile: IdentityProfile =
    leaning === 3
      ? 'operator'
      : leaning === 2
        ? 'anchor'
        : leaning === 4
          ? 'provider'
          : season === 3
            ? 'long-haul'
            : season === 0
              ? 'builder'
              : 'quiet-carrier';

  return {
    pattern,
    patternName: PATTERN_NAMES[pattern],
    bundleKey,
    pathway,
    loadScore,
    loadSeason,
    identityProfile,
    peakBlock,
    // Only "nothing happened" sets it. "Worked for a week or two" does not.
    skepticalFlag: history === 2,
    signals: {
      shape_fires: shape === 1 || shape === 2,
      resource_fires: resource === 0,
      timescale_fires: timescale === 1 || timescale === 2,
      input_fires: input === 1 || input === 2,
      source_fires: source === 0,
      floorCount: floorSignals,
    },
  };
}

/**
 * The demographic block the live quiz infers rather than asks. It is guesswork
 * by design, but downstream copy and the CRM both read these fields, so the
 * inference is reproduced exactly.
 */
export function derivedProfile(a: QuizAnswers): {
  sex: string;
  age_band: string;
  relationship: string;
  kids_count: number;
  job_type: string;
  hours_band: string;
  consumption: string;
} {
  const leaning = a.leaning;
  const season = a.season;
  const source = a.source;
  return {
    sex: 'male',
    age_band: '35-44',
    relationship: leaning === 1 || leaning === 2 || leaning === 4 ? 'married' : 'single',
    kids_count: leaning === 2 || leaning === 4 ? 2 : 0,
    job_type: leaning === 3 ? 'leadership' : 'desk',
    hours_band: season === 2 || season === 3 ? '50-60' : '40-50',
    consumption: source === 0 ? 'coffee-heavy' : source === 1 ? 'coffee-light' : 'willpower',
  };
}

/** Look up the option label for a screen, returning '' when unanswered. */
function opt(screen: number, index: number | undefined, listB = false): string {
  if (index === undefined || index === null) return '';
  const q = QUIZ_QUESTIONS[screen];
  const list = listB ? q?.opts2 : q?.opts;
  return list?.[index] ?? '';
}

/**
 * The `answers` block the live quiz sends. Two things are load bearing: the
 * values are the option LABELS, not indices, and the key names carry a known
 * off-by-one (`q5_source` covers screen 3). Both are reproduced verbatim so
 * existing rows and downstream reporting keep matching.
 */
export function answersPayload(a: QuizAnswers): Record<string, unknown> {
  return {
    q1_shape: opt(0, a.shape),
    q1_peak_block: a.peakBlock ?? '',
    q2_resource: opt(1, a.resource),
    q3_timescale: opt(2, a.timescale),
    q4_input: opt(2, a.input, true),
    q5_source: opt(3, a.source),
    q6_history: opt(4, a.history),
    q7_leaning: opt(5, a.leaning),
    q8_season: opt(6, a.season),
    q9_matters: opt(7, a.matters),
    q10_govern: (a.govern ?? []).map((i) => opt(8, i)).join(','),
    q11_looking: opt(9, a.looking),
    q12_carrying: a.carrying ?? '',
  };
}

/** Every counted screen answered. Screen 10 is optional by design. */
export function isComplete(a: QuizAnswers): boolean {
  if (a.shape === undefined) return false;
  if (a.shape === 0 && !a.peakBlock) return false;
  return (
    a.resource !== undefined &&
    a.timescale !== undefined &&
    a.input !== undefined &&
    a.source !== undefined &&
    a.history !== undefined &&
    a.leaning !== undefined &&
    a.season !== undefined &&
    a.matters !== undefined &&
    (a.govern?.length ?? 0) > 0 &&
    a.looking !== undefined
  );
}

/** Whether a given screen has enough to enable Continue. */
export function canAdvance(step: number, a: QuizAnswers): boolean {
  switch (step) {
    case 0:
      return a.shape !== undefined && (a.shape !== 0 || Boolean(a.peakBlock));
    case 1:
      return a.resource !== undefined;
    case 2:
      return a.timescale !== undefined && a.input !== undefined;
    case 3:
      return a.source !== undefined;
    case 4:
      return a.history !== undefined;
    case 5:
      return a.leaning !== undefined;
    case 6:
      return a.season !== undefined;
    case 7:
      return a.matters !== undefined;
    case 8:
      return (a.govern?.length ?? 0) > 0;
    case 9:
      return a.looking !== undefined;
    case 10:
      return true;
    default:
      return false;
  }
}
