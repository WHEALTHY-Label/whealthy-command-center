/**
 * The Governor's intent layer.
 *
 * Everything here is pure so it can be pinned by tests and imported from both
 * the server action and the client dock. No `server-only`, no fetch.
 *
 * The live app kept this logic inline in index.html around 14842-15400. Three
 * defects in that version are fixed here and each one is marked at its site:
 *
 *   1. `dispatchIntent`'s `default:` branch called `fileEntry(isSheet)`, a
 *      variable that does not exist in that scope. Every unrecognised intent
 *      threw a ReferenceError and the steward's words were dropped on the
 *      floor. Here the fallback is explicit and always keeps the words.
 *   2. `resolveDatePhrase` derived "today" from `toISOString()`, which is UTC.
 *      A steward west of Greenwich burning "today" after 5pm hit the wrong
 *      row. The date now comes from the caller, who knows the local offset.
 *   3. Guarded intents were only guarded when the router agreed. A router that
 *      returns `needs_confirm: false` on `record_burn_entry` could delete a
 *      night's entry without a prompt. `parseIntent` re-applies the guard
 *      after parsing, so the server's opinion cannot override it.
 */

/** Every intent id the router is allowed to return. */
export const GOVERNOR_INTENTS = [
  'journal_entry',
  'record_read_entry',
  'record_query_thread',
  'record_read_map',
  'record_when_last',
  'record_burn_entry',
  'fast_start',
  'fast_status',
  'fast_directive_today',
  'fast_read_passage',
  'fast_how_am_i_doing',
  'fast_mark_report',
  'fast_whats_the_fight',
  'fast_end',
  'scripture_read',
  'scripture_find_theme',
  'scripture_for_me',
  'bible_todays_reading',
  'nav_go',
  'daily_briefing',
  'commerce_read_bundle',
  'commerce_claim',
  'affiliate_read_link',
  'community_draft_invite',
  'ambient_support',
  'unknown',
] as const;

export type GovernorIntentId = (typeof GOVERNOR_INTENTS)[number];

const INTENT_SET: ReadonlySet<string> = new Set<string>(GOVERNOR_INTENTS);

/**
 * Anything that spends money, deletes, starts or ends a commitment, or speaks
 * to another person. These are proposals, never auto-executed.
 */
export const GUARDED_INTENTS: ReadonlySet<GovernorIntentId> = new Set<GovernorIntentId>([
  'record_burn_entry',
  'fast_start',
  'fast_end',
  'commerce_claim',
  'community_draft_invite',
]);

export interface GovernorContext {
  /** The route the steward is looking at, as a short word the router reads. */
  currentView: string;
  /** none | building | active | ended */
  fastState: string;
  /** open | closed until 8:45pm */
  reportOpen: string;
  /** yes | no */
  filedToday: string;
  /** A pipe-joined digest of the three most recent unburned entries. */
  threads: string;
  profileDigest: string;
}

export interface GovernorIntent {
  intent: GovernorIntentId;
  confidence: number;
  slots: Record<string, unknown>;
  speakBack: string;
  scriptureRef: string;
  needsConfirm: boolean;
}

/**
 * The router prompt, kept word for word with the live app. The server pairs it
 * with ROUTER_SYSTEM, so changing the wording here changes classification
 * behaviour. Treat it as a contract, not as copy.
 */
export function buildRouterPrompt(transcript: string, ctx: GovernorContext): string {
  return `Steward said: "${transcript}"

Current context:
- Active view: ${ctx.currentView}
- Fast: ${ctx.fastState}
- Report window: ${ctx.reportOpen}
- Tonight's entry filed: ${ctx.filedToday}
- Recent record threads: ${ctx.threads}
- Profile digest: ${ctx.profileDigest}

Classify into ONE intent and extract slots. Intents and slots:
- journal_entry {text}
- record_read_entry {when}
- record_query_thread {thread}
- record_read_map
- record_when_last {topic}
- record_burn_entry {when}
- fast_start {laid_down:[], whys:[], experience}
- fast_status
- fast_directive_today
- fast_read_passage {which}
- fast_how_am_i_doing
- fast_mark_report {rules_kept:[]}
- fast_whats_the_fight
- fast_end
- scripture_read {reference}
- scripture_find_theme {theme}
- scripture_for_me
- bible_todays_reading
- nav_go {destination}
- daily_briefing
- commerce_read_bundle
- commerce_claim
- affiliate_read_link
- community_draft_invite {who}
- ambient_support {sentiment}
- unknown {text}

Return JSON:
{"intent":"<id>","confidence":0.0,"slots":{...},"speak_back":"<one short spoken answer or confirmation, under 20 words, WHEALTHY voice, scripture rooted by meaning at his comfort level, no em dashes>","scripture_ref":"<library ref or empty>","needs_confirm":true|false}`;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Normalise whatever the model returned into something the dock can act on.
 * An unparseable or unrecognised response degrades to `unknown`, which the
 * dispatcher files as a journal entry, because keeping a steward's words is
 * always the safe outcome.
 */
export function parseIntent(raw: unknown): GovernorIntent {
  const d = (raw ?? {}) as Record<string, unknown>;
  const id = str(d.intent);
  const intent: GovernorIntentId = INTENT_SET.has(id) ? (id as GovernorIntentId) : 'unknown';
  const confidence = typeof d.confidence === 'number' && Number.isFinite(d.confidence)
    ? Math.min(1, Math.max(0, d.confidence))
    : 0;
  const slots =
    typeof d.slots === 'object' && d.slots !== null && !Array.isArray(d.slots)
      ? (d.slots as Record<string, unknown>)
      : {};
  // Defect 3: the guard is re-applied here, after the model has spoken.
  const needsConfirm = GUARDED_INTENTS.has(intent) || d.needs_confirm === true;
  return {
    intent,
    confidence,
    slots,
    speakBack: str(d.speak_back),
    scriptureRef: str(d.scripture_ref),
    needsConfirm,
  };
}

/**
 * The record page's own mic is for the record. Speaking into it while looking
 * at the record means journalling, unless the words are unmistakably a
 * command. The floating Governor keeps whatever the router classified.
 */
export function coerceForSurface(
  intent: GovernorIntent,
  surface: 'governor' | 'record',
  currentView: string,
): GovernorIntent {
  if (surface !== 'record' || currentView !== 'record') return intent;
  const keeps =
    intent.intent === 'record_burn_entry' ||
    intent.intent === 'fast_end' ||
    intent.intent === 'record_read_entry' ||
    intent.intent.startsWith('nav_');
  if (keeps) return intent;
  return { ...intent, intent: 'journal_entry', needsConfirm: false };
}

/** Spoken destination to migrated route. Unknown destinations go home. */
export const NAV_MAP: Readonly<Record<string, string>> = {
  dash: '/',
  dashboard: '/',
  home: '/',
  command: '/',
  record: '/record',
  journal: '/record',
  fast: '/fast',
  community: '/community',
  bible: '/bible',
  word: '/bible',
  affiliate: '/affiliate',
  code: '/affiliate',
  claim: '/claim',
  bundle: '/claim',
  prayer: '/prayer',
  wall: '/wall',
  testimony: '/testimony',
  me: '/me',
  portal: '/portal',
  tryall: '/tryall',
  circle: '/circle',
  circles: '/circle',
  cohort: '/cohort',
  challenge: '/cohort',
  rhythm: '/rhythm',
  admin: '/admin',
};

export function resolveNav(destination: unknown): string {
  const key = str(destination).toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, '');
  return NAV_MAP[key] ?? '/';
}

/**
 * Resolve a spoken date phrase against the steward's LOCAL today, supplied by
 * the caller as `YYYY-MM-DD`. Defect 2: the live version used UTC.
 */
export function resolveDatePhrase(phrase: unknown, todayIso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) return null;
  const p = str(phrase).toLowerCase();
  const base = new Date(`${todayIso}T00:00:00Z`);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const shift = (days: number) => {
    const d = new Date(base.getTime());
    d.setUTCDate(d.getUTCDate() - days);
    return iso(d);
  };

  if (!p || p === 'today' || p === 'tonight') return todayIso;
  if (p === 'yesterday') return shift(1);

  const dm = /(\d+)\s*days?\s*ago/.exec(p);
  if (dm?.[1]) {
    const n = Number(dm[1]);
    // A phrase like "900 days ago" is a mis-hear, not an instruction.
    if (!Number.isFinite(n) || n < 0 || n > 366) return null;
    return shift(n);
  }

  const weekdays = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const wd = weekdays.indexOf(p.replace(/^last\s+/, ''));
  if (wd >= 0) {
    for (let back = 1; back <= 7; back++) {
      const d = new Date(base.getTime());
      d.setUTCDate(d.getUTCDate() - back);
      if (d.getUTCDay() === wd) return iso(d);
    }
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  return null;
}

/** The nightly report opens at 8:45 PM local. */
export const REPORT_OPEN_MIN = 20 * 60 + 45;

export function reportOpenAt(localMinutes: number): boolean {
  return localMinutes >= REPORT_OPEN_MIN;
}

export type DispatchKind =
  | 'journal' // file the words as tonight's entry
  | 'navigate' // go somewhere and say the line
  | 'speak' // say the line, stay put
  | 'confirm' // propose, wait for the steward
  | 'burn'; // the one destructive action the dock performs itself

export interface Dispatch {
  kind: DispatchKind;
  /** Route to push, for `navigate` and for a `confirm` that resolves to one. */
  href: string | null;
  /** What the dock says or shows. Never empty. */
  message: string;
  /** Only set on `confirm`: what happens if the steward agrees. */
  onConfirm?: Dispatch;
  /** Label for the affirmative button on a `confirm`. */
  confirmLabel?: string;
  /** A date the burn will act on, so the confirm copy can name it. */
  entryDate?: string;
}

export interface DispatchInput {
  intent: GovernorIntent;
  /** The steward's local date, `YYYY-MM-DD`. */
  todayIso: string;
  /** Minutes past local midnight, for the report gate. */
  localMinutes: number;
  fastDay?: number | null;
  fastDuration?: number | null;
  filedToday?: boolean;
  bundleName?: string | null;
  affiliateLink?: string | null;
}

function nav(href: string, fallback: string, speakBack: string): Dispatch {
  return { kind: 'navigate', href, message: speakBack || fallback };
}

/**
 * Turn a classified intent into the one thing the dock should do. Pure: the
 * dock performs the effect, this decides it.
 */
export function planDispatch(input: DispatchInput): Dispatch {
  const { intent, todayIso, localMinutes } = input;
  const back = intent.speakBack;

  switch (intent.intent) {
    case 'journal_entry':
      return { kind: 'journal', href: null, message: back || 'Keeping your record.' };

    case 'record_read_entry':
    case 'record_query_thread':
    case 'record_read_map':
    case 'record_when_last':
      return nav('/record', 'Opening the record.', back);

    case 'record_burn_entry': {
      const date = resolveDatePhrase(intent.slots.when, todayIso) ?? todayIso;
      return {
        kind: 'confirm',
        href: null,
        entryDate: date,
        confirmLabel: 'Confirm burn',
        message: `Burn the entry from ${date}? Burned means gone, everywhere, including from what the scribe learns.`,
        onConfirm: { kind: 'burn', href: '/record', message: 'The entry is gone.', entryDate: date },
      };
    }

    case 'fast_start':
      return {
        kind: 'confirm',
        href: null,
        confirmLabel: 'Set it up',
        message: back || 'Start a fast? I will take you to set it up. You lay down what you lay down.',
        onConfirm: nav('/fast/build', 'Opening the fast.', back),
      };

    case 'fast_end':
      return {
        kind: 'confirm',
        href: null,
        confirmLabel: 'End the fast',
        message: back || 'End the fast? I will take you there to close it out properly.',
        onConfirm: nav('/fast', 'Opening the fast.', back),
      };

    case 'fast_status':
    case 'fast_directive_today':
    case 'fast_read_passage':
    case 'fast_how_am_i_doing':
    case 'fast_mark_report':
    case 'fast_whats_the_fight':
      return nav('/fast', 'Opening the fast.', back);

    case 'scripture_read':
    case 'scripture_find_theme':
    case 'scripture_for_me':
    case 'bible_todays_reading':
      return nav('/bible', "Opening today's Word.", back);

    case 'nav_go': {
      const href = resolveNav(intent.slots.destination);
      return nav(href, 'Moving.', back);
    }

    case 'daily_briefing': {
      const parts: string[] = ['Here is your daily briefing.'];
      if (input.fastDay && input.fastDuration) {
        parts.push(`You are on Day ${input.fastDay} of ${input.fastDuration}.`);
      }
      parts.push(input.filedToday ? "Tonight's entry has been filed." : "Tonight's entry is open.");
      parts.push(
        reportOpenAt(localMinutes)
          ? 'The nightly report is open.'
          : 'The nightly report opens at 8:45 PM.',
      );
      return { kind: 'speak', href: null, message: parts.join(' ') };
    }

    case 'commerce_read_bundle':
      return {
        kind: 'speak',
        href: null,
        message: input.bundleName
          ? `Your current bundle is ${input.bundleName}.`
          : back || 'No bundle is set up yet. The claim page will start one.',
      };

    case 'commerce_claim':
      return {
        kind: 'confirm',
        href: null,
        confirmLabel: 'Take me there',
        message: back || 'Taking you to start your routine. You finish the checkout.',
        onConfirm: nav('/claim', 'Opening the claim page.', ''),
      };

    case 'affiliate_read_link':
      return input.affiliateLink
        ? { kind: 'speak', href: null, message: `Your link is ${input.affiliateLink}.` }
        : nav('/affiliate', 'Generate your link first.', back);

    case 'community_draft_invite': {
      const who = str(intent.slots.who) || 'your friend';
      return {
        kind: 'confirm',
        href: null,
        confirmLabel: 'Draft it',
        message: `Draft an invite for ${who}? I will open the community page with it ready.`,
        onConfirm: nav('/community', 'Opening the community.', ''),
      };
    }

    case 'ambient_support':
      return {
        kind: 'speak',
        href: null,
        message: back || 'We keep the record to govern the rhythm. Your words are held.',
      };

    // Defect 1: the live app threw a ReferenceError here. Unknown means we did
    // not understand the command, and the safe reading of an unclear sentence
    // is that it belongs in the record.
    case 'unknown':
    default:
      return { kind: 'journal', href: null, message: 'Not sure what that was, so I kept it.' };
  }
}
