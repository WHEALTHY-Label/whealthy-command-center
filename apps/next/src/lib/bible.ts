/**
 * Scripture parsing and Bible 365 arithmetic.
 *
 * bible-verses answers: { reference, verses: [{book_name, chapter, verse,
 * text}], text, translation_id: "BSB", ... } (Berean Standard Bible).
 * my-bible-marks list answers: { ok, marks: [{id, book, chapter, verse,
 * kind: "highlight"|"note", body, created_at}] }.
 */

export interface Verse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface Passage {
  reference: string;
  verses: Verse[];
}

export function parsePassage(data: unknown): Passage | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.verses)) return null;
  return {
    reference: typeof d.reference === 'string' ? d.reference : '',
    verses: d.verses
      .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
      .map((v) => ({
        book: typeof v.book_name === 'string' ? v.book_name : '',
        chapter: typeof v.chapter === 'number' ? v.chapter : 0,
        verse: typeof v.verse === 'number' ? v.verse : 0,
        text: typeof v.text === 'string' ? v.text : '',
      })),
  };
}

export interface BibleMark {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  kind: 'highlight' | 'note';
  body: string | null;
  createdAt: string | null;
}

export function parseMarks(data: unknown): BibleMark[] {
  if (typeof data !== 'object' || data === null) return [];
  const marks = (data as Record<string, unknown>).marks;
  if (!Array.isArray(marks)) return [];
  return marks
    .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
    .filter((m) => m.kind === 'highlight' || m.kind === 'note')
    .map((m) => ({
      id: String(m.id ?? ''),
      book: typeof m.book === 'string' ? m.book : '',
      chapter: typeof m.chapter === 'number' ? m.chapter : 0,
      verse: typeof m.verse === 'number' ? m.verse : 0,
      kind: m.kind as 'highlight' | 'note',
      body: typeof m.body === 'string' ? m.body : null,
      createdAt: typeof m.created_at === 'string' ? m.created_at : null,
    }));
}

/**
 * The 365 plan is calendar-driven, exactly like the live app: Day 1 is the
 * start date and the count advances whether or not the reading happened.
 */
export function day365(startDateIso: string, todayIso: string): number {
  const start = Date.parse(startDateIso);
  const today = Date.parse(todayIso);
  if (Number.isNaN(start) || Number.isNaN(today)) return 1;
  const day = Math.floor((today - start) / 86400000) + 1;
  return Math.min(365, Math.max(1, day));
}

/** Consecutive completed days ending at (or just before) the current day. */
export function streak365(completed: number[], currentDay: number): number {
  const done = new Set(completed);
  let day = done.has(currentDay) ? currentDay : currentDay - 1;
  let count = 0;
  while (day >= 1 && done.has(day)) {
    count += 1;
    day -= 1;
  }
  return count;
}

export interface BibleProgress {
  startDate: string;
  completed: number[];
  streak: number;
}

/** bible_progress row → view. Null when the study has not begun. */
export function parseProgressRow(row: unknown): BibleProgress | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.start_date !== 'string') return null;
  const completed = Array.isArray(r.completed_days)
    ? r.completed_days.filter((d): d is number => typeof d === 'number')
    : [];
  return {
    startDate: r.start_date,
    completed,
    streak: typeof r.streak === 'number' ? r.streak : 0,
  };
}

/**
 * Did the steward bring a prayer to the wall today?
 *
 * This is the Community Prayer sanctuary task. The live app answered it from
 * `localStorage.wh_bible_prayers_completed`, which meant the check cleared
 * itself on a second device and came back on a cleared cache. The prayers
 * themselves have always been rows in `wall_posts`, so the honest answer is
 * whether one of the member's own posts carries today's date. Nothing new is
 * stored and the answer follows the member wherever they sign in.
 *
 * `todayIso` and `createdAt` are compared as UTC calendar days, the same basis
 * Day N of 365 is counted on, so the task and the reading turn over together.
 */
export function broughtPrayerToday(
  posts: { createdAt: string | null }[],
  todayIso: string,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) return false;
  return posts.some((p) => {
    if (!p.createdAt) return false;
    const t = Date.parse(p.createdAt);
    if (Number.isNaN(t)) return false;
    return new Date(t).toISOString().slice(0, 10) === todayIso;
  });
}
