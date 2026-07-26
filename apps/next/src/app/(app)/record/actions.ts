'use server';

import { revalidatePath } from 'next/cache';
import { memberFn } from '@/lib/fn';
import { askGovernor } from '@/lib/actions/governor';

const GENERIC = 'That did not save. Please try again.';

export interface ScribeResult {
  people: string[];
  burdens: string[];
  wins: string[];
  scribeLine: string;
  tone: 'heavy' | 'win' | 'mixed';
}

export interface FileEntryResult {
  ok: boolean;
  error?: string;
  gateClosed?: boolean;
  scribe?: ScribeResult | null;
  offline?: boolean;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 8) : [];
}

/**
 * File tonight's entry: the scribe structures it, then governor-state keeps
 * it. The 8:45 PM local gate lives in the edge function and only applies
 * when the entry carries a fast day; tz_offset_min is what it judges by.
 */
export async function fileJournalEntry(
  rawText: string,
  tzOffsetMin: number,
  fastId: string | null,
  fastDay: number | null,
): Promise<FileEntryResult> {
  const text = rawText.trim();
  if (!text) return { ok: false, error: 'Say it first. The scribe keeps your words.' };
  if (text.length > 8000) return { ok: false, error: 'Keep tonight under 8000 characters.' };

  const offset = Number.isFinite(tzOffsetMin) ? Math.max(-840, Math.min(840, tzOffsetMin)) : 0;
  // Entry date is the member's local date, derived from the same offset the
  // gate uses.
  const entryDate = new Date(Date.now() - offset * 60000).toISOString().slice(0, 10);

  // Ask the scribe to structure the entry. If the scribe is unreachable the
  // words are still kept; that is the legacy offline promise.
  const scribeCall = await askGovernor(
    'scribe',
    [
      'Structure this journal entry. Return ONLY JSON with keys:',
      '{"people":[],"burdens":[],"wins":[],"scribe_line":"","tone":"heavy|win|mixed",',
      '"resurface":{"use":false,"date":"","excerpt":"","why":""}}',
      'Keep scribe_line to one short sentence in the WHEALTHY voice. No em dashes.',
      '',
      `ENTRY: ${text}`,
    ].join('\n'),
  );

  let scribe: ScribeResult | null = null;
  if (scribeCall.ok && typeof scribeCall.out === 'object' && scribeCall.out !== null) {
    const out = scribeCall.out as Record<string, unknown>;
    scribe = {
      people: strArr(out.people),
      burdens: strArr(out.burdens),
      wins: strArr(out.wins),
      scribeLine: typeof out.scribe_line === 'string' ? out.scribe_line : '',
      tone: out.tone === 'heavy' || out.tone === 'win' ? out.tone : 'mixed',
    };
  }

  const save = await memberFn('governor-state', {
    action: 'save_entry',
    entry_date: entryDate,
    text,
    tone: scribe?.tone ?? 'mixed',
    fast_id: fastId,
    fast_day: fastDay,
    scribe_line: scribe?.scribeLine ?? null,
    resurface: null,
    tz_offset_min: offset,
  });
  if (!save.ok || save.data.ok === false) {
    const code = !save.ok
      ? save.code
      : typeof save.data.error === 'string'
        ? save.data.error
        : '';
    if (code === 'report_not_open') {
      return {
        ok: false,
        gateClosed: true,
        error: 'The Command Center gate is closed. Reporting only opens after 8:45 PM local time.',
      };
    }
    return { ok: false, error: GENERIC };
  }

  revalidatePath('/record');
  return { ok: true, scribe, offline: scribe === null };
}

export interface BurnResult {
  ok: boolean;
  error?: string;
}

/** Burned means gone, everywhere, including from what the scribe learns. */
export async function burnRecordEntry(entryDate: string): Promise<BurnResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) return { ok: false, error: GENERIC };
  const call = await memberFn('governor-state', { action: 'burn_entry', entry_date: entryDate });
  if (!call.ok || call.data.ok === false) return { ok: false, error: GENERIC };
  revalidatePath('/record');
  return { ok: true };
}

export interface Thread {
  name: string;
  count: number;
  weight: 'heavy' | 'steady' | 'turning';
  line: string;
}

export interface ThreadsResult {
  ok: boolean;
  threads: Thread[];
  observation: string;
}

/** The Threads map: what keeps returning across the live entries. */
export async function readThreads(entryTexts: string[]): Promise<ThreadsResult> {
  const digest = entryTexts
    .filter((t) => typeof t === 'string' && t.trim())
    .slice(0, 40)
    .map((t, i) => `[${i + 1}] ${t.slice(0, 400)}`)
    .join('\n');
  if (!digest) return { ok: false, threads: [], observation: '' };

  const call = await askGovernor(
    'threads',
    [
      'From these journal entries, name the threads that keep returning: the',
      'people, the burdens, the wins. Return ONLY JSON:',
      '{"threads":[{"name":"","count":0,"weight":"heavy|steady|turning","line":""}],"observation":""}',
      'Name the pattern. Never interpret the heart. No em dashes.',
      '',
      digest,
    ].join('\n'),
  );
  if (!call.ok || typeof call.out !== 'object' || call.out === null) {
    return { ok: false, threads: [], observation: '' };
  }
  const out = call.out as Record<string, unknown>;
  const threads: Thread[] = Array.isArray(out.threads)
    ? out.threads
        .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
        .map((t): Thread => {
          const weight: Thread['weight'] =
            t.weight === 'heavy' ? 'heavy' : t.weight === 'turning' ? 'turning' : 'steady';
          return {
            name: typeof t.name === 'string' ? t.name : '',
            count: typeof t.count === 'number' ? t.count : 0,
            weight,
            line: typeof t.line === 'string' ? t.line : '',
          };
        })
        .filter((t) => t.name)
    : [];
  return {
    ok: true,
    threads,
    observation: typeof out.observation === 'string' ? out.observation : '',
  };
}
