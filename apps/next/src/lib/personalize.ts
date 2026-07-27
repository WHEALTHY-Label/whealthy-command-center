/**
 * The dashboard's AI personalization, ported from `waFetchAIPersonalization`
 * at index.html:12080-12205.
 *
 * Everything here is pure so it can be tested. The call itself lives in
 * `src/lib/actions/personalize.ts` (a server action, so every export there
 * must be async) and the post-mount trigger lives in the dashboard's
 * `DirectiveCard`.
 *
 * The legacy flow: build one long system prompt out of the steward's own
 * state, ask `governor-ai` with task `synthesis`, and use the returned JSON to
 * replace the dashboard greeting and the Daily Directive. The port keeps the
 * prompt text and the JSON schema, because the deployed function's retry loop
 * validates against that schema and cannot be changed without a redeploy.
 */

/** The greeting the legacy app fell back to outside the three named windows. */
export const DEFAULT_GREETING = 'Welcome back';

/**
 * The local-hour greeting. Thresholds are the live app's: 5-12, 12-17, 17-22,
 * everything else falls back. The hour has to come from the browser, because
 * the server has no idea what time it is where the steward is standing.
 */
export function timeGreeting(hour: number): string {
  if (!Number.isFinite(hour)) return DEFAULT_GREETING;
  const h = Math.floor(hour);
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return DEFAULT_GREETING;
}

export interface FastContext {
  day: number;
  duration: number;
  phase?: string | null;
}

/**
 * The `Fast status` context line.
 *
 * The legacy version read `S.fast.active` and `S.fast.start_time` and reported
 * hours elapsed. The `fasts` row that `governor-state` actually returns has
 * neither field: it carries `status`, `start_date`, `duration` and `plan`. So
 * the legacy branch could never fire and every prompt ever sent said "No
 * active fast" even mid-fast. This reports the day-based fast the rest of the
 * app already derives, which is the same fast the dashboard prints above it.
 */
export function fastContextLine(fast: FastContext | null): string {
  if (!fast || !Number.isFinite(fast.day) || fast.day < 1) return 'No active fast';
  const target = fast.duration > 0 ? `, target duration: ${fast.duration} days` : '';
  const phase = fast.phase && fast.phase.trim().length > 0 ? fast.phase.trim() : 'stewardship';
  return `Active fast: day ${fast.day}${target}. Current phase: ${phase}`;
}

export interface BibleContext {
  streak: number;
  completedToday: boolean;
}

/**
 * The `Bible reading status` context line.
 *
 * The legacy check was `completed_days.includes(new Date().getDate())`, which
 * compares a 1-365 plan day against a 1-31 day of the month. It answered "yes"
 * on the first 28 to 31 days of a plan and then went permanently silent. The
 * caller computes the real plan day, so this only formats.
 */
export function bibleContextLine(bible: BibleContext | null): string {
  if (!bible) return 'No active reading';
  const streak = Number.isFinite(bible.streak) && bible.streak > 0 ? Math.floor(bible.streak) : 0;
  return `Bible reading streak: ${streak} days. Completed today: ${bible.completedToday ? 'yes' : 'no'}`;
}

/**
 * The `Directives logged` context line. The legacy version counted checked
 * `.habit-checkbox` nodes in the DOM; the port counts the rhythm slots the
 * server already returns with their `done` flag.
 */
export function habitsContextLine(done: number, total: number): string {
  if (!Number.isFinite(total) || total <= 0) return 'No habits logged today';
  const cap = Math.floor(total);
  const kept = Number.isFinite(done) && done > 0 ? Math.min(Math.floor(done), cap) : 0;
  return `${kept} of ${cap} daily directives completed today`;
}

export interface JournalEntry {
  entryDate: string;
  text: string;
  fastDay: number | null;
  burned: boolean;
}

/** `governor-state` load → the journal entries the prompt is allowed to see. */
export function parseJournalEntries(data: unknown): JournalEntry[] {
  if (typeof data !== 'object' || data === null) return [];
  const entries = (data as Record<string, unknown>).entries;
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .filter((e) => typeof e.entry_date === 'string')
    .map((e) => ({
      entryDate: e.entry_date as string,
      text: typeof e.text === 'string' ? e.text : '',
      fastDay: typeof e.fast_day === 'number' ? e.fast_day : null,
      burned: e.burned === true,
    }));
}

/**
 * `entriesBlock()` from index.html, verbatim in shape: burned entries are
 * dropped, and a fast day is annotated inline when the entry carries one.
 * A burned entry is one the steward chose to destroy, so it never reaches a
 * model.
 */
export function entriesBlock(entries: JournalEntry[]): string {
  return entries
    .filter((e) => !e.burned)
    .filter((e) => e.text.trim().length > 0)
    .map((e) => `[${e.entryDate}]${e.fastDay ? ` (fast day ${e.fastDay})` : ''} ${e.text}`)
    .join('\n');
}

export const NO_JOURNAL = 'No accessible journal entries (or all entries are private/burned).';

/** The `Journal entries` context line. */
export function journalContextLine(entries: JournalEntry[]): string {
  const block = entriesBlock(entries);
  return block.length > 0 ? `Steward's recent non-burned journal entries:\n${block}` : NO_JOURNAL;
}

export interface SynthesisContext {
  name: string;
  archetype: string;
  hour: number;
  fastInfo: string;
  bibleInfo: string;
  habitsInfo: string;
  journalContext: string;
}

/**
 * The `synthesis` system prompt. Kept close to index.html:12138-12200 on
 * purpose: the deployed `governor-ai` validates the generated JSON against
 * this exact schema and retries once on a banned phrase, so a prompt that
 * asks for a different shape gets a `generation_failed` and no directive.
 */
export function buildSynthesisPrompt(ctx: SynthesisContext): string {
  const greeting = timeGreeting(ctx.hour);
  const hour = Number.isFinite(ctx.hour) ? Math.floor(ctx.hour) : 0;
  return `You are personalizing the WHEALTHY dashboard for a steward.
Generate custom, brief title greetings and subtitles for each main view of the app:
1. Home (dashTitle/dashSubtitle)
2. Bible 365 (bibleTitle/bibleSubtitle)
3. The Fast (fastTitle/fastSubtitle)
4. The Record (recordTitle/recordSubtitle)

Steward Context:
- Name: ${ctx.name}
- Archetype: ${ctx.archetype}
- Current Local Time of Day: ${greeting} (Hour: ${hour})
- Fast status: ${ctx.fastInfo}
- Bible reading status: ${ctx.bibleInfo}
- Directives logged: ${ctx.habitsInfo}
- Journal entries: ${ctx.journalContext}

Voice Guidelines for Time of Day:
- Since the current local time greeting is "${greeting}", make sure the dashTitle starts exactly with "${greeting}, [Name]" or similar, and the dashSubtitle matches the energy focus of this time of day (e.g. if afternoon, focus on maintaining alignment, if evening, focus on laying down the record). Do not reference the morning window unless it is actually morning.

Daily Directive Guidelines:
- Generate a dynamic, actionable 1-sentence focus for the day to return in "dailyDirective".
- If journal entries are provided, use them to personalize the directive (e.g., addressing topics or patterns they mentioned, reflecting their own idiom, or tailoring focus to their described wins/burdens).
- If no journal entries are available (or marked private/burned), personalize the directive based on their archetype, fast phase, and Bible reading progress.
- Keep the directive brief (1 sentence), actionable, and WHEALTHY-aligned (no health claims, focus on stewardship/routine).

Return ONLY a valid JSON object matching this schema exactly (no preamble, no markdown blocks):
{
  "dashTitle": "${greeting}, [Name]",
  "dashSubtitle": "[A brief dynamic 1-sentence focus message based on their active fast/habits/archetype/time of day]",
  "dailyDirective": "[Dynamic, personalized actionable daily directive]",
  "bibleTitle": "Bible 365",
  "bibleSubtitle": "[Dynamic message encouraging them based on their Bible streak/status]",
  "fastTitle": "The Fast",
  "fastSubtitle": "[Dynamic message based on their active fast duration or setup stage]",
  "recordTitle": "Steward's Journal",
  "recordSubtitle": "[Dynamic message summarizing their progress/directives today]"
}`;
}

export interface Personalization {
  dashTitle: string | null;
  dashSubtitle: string | null;
  dailyDirective: string | null;
  bibleTitle: string | null;
  bibleSubtitle: string | null;
  fastTitle: string | null;
  fastSubtitle: string | null;
  recordTitle: string | null;
  recordSubtitle: string | null;
}

const FIELDS = [
  'dashTitle',
  'dashSubtitle',
  'dailyDirective',
  'bibleTitle',
  'bibleSubtitle',
  'fastTitle',
  'fastSubtitle',
  'recordTitle',
  'recordSubtitle',
] as const;

function line(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/**
 * Narrow `governor-ai`'s `out` to the nine fields the app renders. Returns
 * null when nothing usable came back, so the caller keeps what the server
 * already rendered rather than blanking the card.
 *
 * The deployed function parses the model's JSON itself and returns an object,
 * but a raw string is still accepted in case it ever passes one through.
 */
export function parsePersonalization(out: unknown): Personalization | null {
  let raw: unknown = out;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  const result = {
    dashTitle: line(d.dashTitle),
    dashSubtitle: line(d.dashSubtitle),
    dailyDirective: line(d.dailyDirective),
    bibleTitle: line(d.bibleTitle),
    bibleSubtitle: line(d.bibleSubtitle),
    fastTitle: line(d.fastTitle),
    fastSubtitle: line(d.fastSubtitle),
    recordTitle: line(d.recordTitle),
    recordSubtitle: line(d.recordSubtitle),
  };
  return FIELDS.some((f) => result[f] !== null) ? result : null;
}

/** Days between two instants, for the community nudge spacing. */
const DAY_MS = 86400000;

/**
 * Whether `governor-ai` may weave a wall nudge into today's directive.
 *
 * Five days between nudges, matching index.html:12202. A stamp that will not
 * parse blocks the nudge rather than opening the gate, which is what the
 * legacy arithmetic did too (a NaN comparison is false).
 */
export function allowCommunityDirective(lastShownAtIso: string | null, nowMs: number): boolean {
  if (!lastShownAtIso) return true;
  const last = Date.parse(lastShownAtIso);
  if (Number.isNaN(last) || !Number.isFinite(nowMs)) return false;
  return (nowMs - last) / DAY_MS >= 5;
}

/**
 * Did the directive actually mention the wall? Only then is the nudge stamped
 * spent, so a directive that never mentioned it does not burn the five days.
 */
export function mentionsWall(directive: string | null): boolean {
  if (!directive) return false;
  const d = directive.toLowerCase();
  return d.includes('wall') || d.includes('burden') || d.includes('carry');
}
