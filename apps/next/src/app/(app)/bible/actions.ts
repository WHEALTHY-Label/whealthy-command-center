'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthedEmail } from '@/lib/auth/session';
import { memberFn } from '@/lib/fn';
import { askGovernor } from '@/lib/actions/governor';
import { parseMarks, streak365, type BibleMark } from '@/lib/bible';

const GENERIC = 'That did not save. Please try again.';

export interface SimpleResult {
  ok: boolean;
  error?: string;
}

/**
 * Begin the 365 study. bible_progress is RLS-scoped to auth.uid(), so the
 * session client writes the member's own row and nothing else.
 */
export async function begin365(rawStart: string): Promise<SimpleResult> {
  const start = /^\d{4}-\d{2}-\d{2}$/.test(rawStart)
    ? rawStart
    : new Date().toISOString().slice(0, 10);
  const email = await getAuthedEmail();
  if (!email) return { ok: false, error: 'Not signed in.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  const { error } = await supabase.from('bible_progress').upsert(
    {
      user_id: user.id,
      email,
      start_date: start,
      completed_days: [],
      streak: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) return { ok: false, error: GENERIC };
  revalidatePath('/bible');
  return { ok: true };
}

/** Toggle a day's reading complete and recompute the streak. */
export async function toggle365Day(rawDay: number, currentDay: number): Promise<SimpleResult> {
  const day = Math.floor(rawDay);
  if (day < 1 || day > 365) return { ok: false, error: GENERIC };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  const { data: row, error: readError } = await supabase
    .from('bible_progress')
    .select('completed_days')
    .eq('user_id', user.id)
    .maybeSingle();
  if (readError || !row) return { ok: false, error: GENERIC };
  const completed = Array.isArray((row as { completed_days?: unknown }).completed_days)
    ? ((row as { completed_days: unknown[] }).completed_days.filter(
        (d): d is number => typeof d === 'number',
      ) as number[])
    : [];
  const next = completed.includes(day) ? completed.filter((d) => d !== day) : [...completed, day];
  const { error } = await supabase
    .from('bible_progress')
    .update({
      completed_days: next,
      streak: streak365(next, Math.floor(currentDay)),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);
  if (error) return { ok: false, error: GENERIC };
  revalidatePath('/bible');
  return { ok: true };
}

/** Save the day's reflection through governor-state. */
export async function saveReflection(
  dayNumber: number,
  scriptureRef: string,
  said: string,
  willDo: string,
  share: boolean,
): Promise<SimpleResult> {
  const call = await memberFn('governor-state', {
    action: 'save_reflection',
    day_number: Math.floor(dayNumber),
    scripture_ref: scriptureRef.slice(0, 80),
    said: said.slice(0, 2000),
    will_do: willDo.slice(0, 2000),
    share_personalization: share === true,
  });
  if (!call.ok || call.data.ok === false) return { ok: false, error: GENERIC };
  return { ok: true };
}

export interface WordResult {
  arrived: boolean;
  reference?: string;
  text?: string;
  archetype?: string;
}

/**
 * Ask whether a word arrives today. The function is idempotent per day and
 * self-gating (kept day, frequency, weekly cap), so calling after a kept
 * reading is exactly the legacy trigger.
 */
export async function checkWordArrives(): Promise<WordResult> {
  const call = await memberFn('word-arrives', {});
  if (!call.ok || call.data.arrived !== true) return { arrived: false };
  return {
    arrived: true,
    reference:
      typeof call.data.reference === 'string'
        ? call.data.reference
        : typeof call.data.ref === 'string'
          ? call.data.ref
          : undefined,
    text: typeof call.data.text === 'string' ? call.data.text : undefined,
    archetype: typeof call.data.reason === 'string' ? call.data.reason : undefined,
  };
}

/** Persist the reader position; my-bible-state coerces the mode itself. */
export async function saveBibleSpot(
  book: string,
  chapter: number,
  verse: number | null,
  mode: 'my_bible' | 'bible_365',
): Promise<void> {
  if (!book || chapter < 1) return;
  await memberFn('my-bible-state', {
    action: 'set',
    book: book.slice(0, 40),
    chapter: Math.floor(chapter),
    verse: verse === null ? null : Math.floor(verse),
    mode,
  });
}

export interface MarksResult {
  ok: boolean;
  marks: BibleMark[];
}

export async function listMarks(): Promise<MarksResult> {
  const call = await memberFn('my-bible-marks', { action: 'list' });
  if (!call.ok) return { ok: false, marks: [] };
  return { ok: true, marks: parseMarks(call.data) };
}

export async function addMark(
  book: string,
  chapter: number,
  verse: number,
  kind: 'highlight' | 'note',
  body: string | null,
): Promise<MarksResult> {
  const call = await memberFn('my-bible-marks', {
    action: 'add',
    book: book.slice(0, 40),
    chapter: Math.floor(chapter),
    verse: Math.floor(verse),
    kind,
    ...(kind === 'note' ? { body: (body ?? '').slice(0, 2000) } : {}),
  });
  if (!call.ok) return { ok: false, marks: [] };
  return listMarks();
}

export async function removeMark(id: string): Promise<MarksResult> {
  await memberFn('my-bible-marks', { action: 'remove', id });
  return listMarks();
}

export interface BuddyResult {
  reply: string | null;
  verses: { reference: string; text: string }[];
}

/** The Steward's Bible Buddy, backed by governor-ai's bible_study task. */
export async function askBibleBuddy(
  question: string,
  book: string,
  chapter: number,
): Promise<BuddyResult> {
  const q = question.trim().slice(0, 1000);
  if (!q) return { reply: null, verses: [] };
  const result = await askGovernor('bible_study', q, { context: { book, chapter } });
  if (!result.ok || typeof result.out !== 'object' || result.out === null) {
    return { reply: null, verses: [] };
  }
  const out = result.out as Record<string, unknown>;
  const verses = Array.isArray(out.verses)
    ? out.verses
        .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
        .map((v) => ({
          reference: typeof v.reference === 'string' ? v.reference : '',
          text: typeof v.text === 'string' ? v.text : '',
        }))
    : [];
  return { reply: typeof out.reply === 'string' ? out.reply : null, verses };
}
