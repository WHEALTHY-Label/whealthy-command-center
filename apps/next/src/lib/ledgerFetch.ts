import 'server-only';
import { cache } from 'react';
import { addDaysIso, chicagoDate } from '@/lib/day';
import { getPublicEnv } from '@/lib/env';
import { memberFn } from '@/lib/fn';
import { parsePassage } from '@/lib/bible';
import {
  EMPTY_LEDGER,
  MERCY_REF,
  chainChip,
  parseLedger,
  type ChainKey,
  type Ledger,
} from '@/lib/ledger';

export interface LedgerView {
  ledger: Ledger;
  /** The steward's calendar day in America/Chicago. */
  today: string;
  /** The mercy verse text, fetched only when a chain is actually broken. */
  mercyVerse: string | null;
}

/**
 * The steward's discipline ledger for the current week.
 *
 * `reloadLedger` at index.html:12821 asked for a fifteen day window ending
 * today: `to = realToday()`, `from = addDays(to, -14)`. The window is wider
 * than the seven dots the chip draws because the chain arithmetic inside
 * `discipline-day` needs the days before this Monday to know whether a chain
 * carried into the week, and because the function rejects a range shorter than
 * a day or longer than 92.
 *
 * `to` is the America/Chicago date, not the UTC one. That is what the live app
 * sent and what the function's own `toChicagoDate` compares against, so a
 * steward opening the Command Center at 9pm sees tonight rather than tomorrow.
 *
 * Never throws. A ledger that cannot be read comes back empty, which draws a
 * quiet chip rather than an error, exactly as the live app's silent catch did.
 *
 * The clock is read here rather than in the page because `react-hooks/purity`
 * bars a `Date.now()` call during render, and because "today" belongs with the
 * request that asked for it.
 */
const fetchLedgerDays = cache(async (): Promise<{ ledger: Ledger; today: string }> => {
  const today = chicagoDate(Date.now());
  const from = addDaysIso(today, -14);
  if (today === '' || from === '') return { ledger: EMPTY_LEDGER, today };
  const res = await memberFn('discipline-day', { from, to: today });
  return { ledger: res.ok ? parseLedger(res.data) : EMPTY_LEDGER, today };
});

/**
 * The ledger, with the mercy verse resolved for one particular chain.
 *
 * `chainKey` is the chip the caller is about to draw, and `null` when it is
 * drawing no chip at all. It matters because the live app called
 * `fetchVerseForNudge(containerId)` from inside `renderChainChip`, once per
 * chip, so the Word surface fetched the verse when the *word* chain was broken
 * even if the rhythm chain was holding. Deciding it from the rhythm chain alone
 * would leave the Word surface printing a bare reference with no verse under it.
 *
 * `fetchLedgerDays` is cached separately so two chips in one request still cost
 * one `discipline-day` call.
 */
export const fetchLedgerFor = cache(async (chainKey: ChainKey | null): Promise<LedgerView> => {
  const { ledger, today } = await fetchLedgerDays();
  // The live app only fetched the verse when the nudge was actually showing.
  const broken = chainKey !== null && chainChip(ledger, chainKey, today)?.showVerse === true;
  return { ledger, today, mercyVerse: broken ? await fetchMercyVerse() : null };
});

/** The Command Center's own ledger: the rhythm chain. */
export function fetchLedger(): Promise<LedgerView> {
  return fetchLedgerFor('rhythm');
}

/**
 * The mercy verse under a broken chain.
 *
 * The live app printed the reference first and then swapped in the text from
 * `bible-verses` (`fetchVerseForNudge`, index.html:12718). Fetching it on the
 * server instead means no browser request, which matters: a `fetch` from a
 * client component to a function whose CORS allowlist is narrower than the
 * headers the browser sends is the bug class this port has already closed
 * once. Returns `null` when the text is unavailable and the caller falls back
 * to the bare reference, which is what the steward saw for the first moment on
 * the live app anyway.
 */
export const fetchMercyVerse = cache(async (): Promise<string | null> => {
  const env = getPublicEnv();
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_FN_BASE}/bible-verses?ref=${encodeURIComponent(MERCY_REF)}`,
      {
        headers: {
          apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        // The BSB text of two verses never changes; let the CDN hold it.
        next: { revalidate: 86400 },
      },
    );
    if (!res.ok) return null;
    const passage = parsePassage(await res.json());
    if (!passage) return null;
    const text = passage.verses
      .map((v) => v.text.trim())
      .filter((t) => t.length > 0)
      .join(' ')
      .trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
});
