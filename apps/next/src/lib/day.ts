/**
 * The steward's calendar day.
 *
 * The whole system counts days in America/Chicago, not UTC. The live app's
 * `realToday()` at index.html:12697 is `dayKey(0)`, which formats the current
 * instant through `Intl.DateTimeFormat` with `timeZone: 'America/Chicago'`, and
 * every deployed edge function that turns a timestamp into a date agrees:
 * `discipline-day` has its own `toChicagoDate` for exactly this.
 *
 * That matters because a UTC date rolls over five hours early (six in winter).
 * Between 7pm and midnight Chicago, `new Date().toISOString().slice(0, 10)`
 * already says tomorrow: a fast reports Day N+1 before the steward has gone to
 * bed on day N, a reading logged at 9pm lands on the wrong day, and a chain
 * that was kept looks broken.
 *
 * Every function here is pure. `nowMs` is always passed in rather than read,
 * because `react-hooks/purity` bars a clock read during render and because a
 * clock a test cannot set is a clock a test cannot check.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const CHICAGO = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `YYYY-MM-DD` in America/Chicago for a given instant. `''` for junk input. */
export function chicagoDate(nowMs: number): string {
  if (!Number.isFinite(nowMs)) return '';
  const parts = CHICAGO.formatToParts(new Date(nowMs));
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

/** True for a well formed `YYYY-MM-DD`. */
export function isIsoDate(iso: string): boolean {
  return ISO_DATE.test(iso) && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`));
}

/**
 * Shift a date string by whole days.
 *
 * Done at UTC midnight on purpose: a date-only string carries no time, so
 * there is no offset to preserve and no daylight saving transition to fall
 * into. Returns `''` rather than a bogus date when the input is not a date.
 */
export function addDaysIso(iso: string, days: number): string {
  if (!isIsoDate(iso) || !Number.isFinite(days)) return '';
  const ms = Date.parse(`${iso}T00:00:00Z`) + Math.trunc(days) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The Monday of the calendar week a date falls in.
 *
 * Monday to Sunday, matching `getMondayStr` at index.html:12707 and the week
 * grace window `discipline-day` computes chains against. Sunday belongs to the
 * week that began six days earlier, not the one starting tomorrow.
 */
export function mondayOf(iso: string): string {
  if (!isIsoDate(iso)) return '';
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDaysIso(iso, dow === 0 ? -6 : 1 - dow);
}

/** Whole days from `from` to `to`, negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number | null {
  if (!isIsoDate(from) || !isIsoDate(to)) return null;
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** The English weekday name for a date string, or `''` for junk. */
export function dayName(iso: string): string {
  if (!isIsoDate(iso)) return '';
  return WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? '';
}

/** The seven dates of the Monday to Sunday week containing `iso`. */
export function weekOf(iso: string): string[] {
  const monday = mondayOf(iso);
  if (monday === '') return [];
  return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
}
