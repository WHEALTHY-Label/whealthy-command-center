import { describe, expect, it } from 'vitest';
import {
  chainChip,
  DISCIPLINE_CARDS,
  EMPTY_LEDGER,
  keptOn,
  keptToday,
  keptTodayLine,
  parseLedger,
  quietState,
} from './ledger';

const TODAY = '2026-07-22'; // a Wednesday

/** A payload shaped like the one discipline-day v7 actually returns. */
function payload(over: Record<string, unknown> = {}) {
  return {
    days: [
      { date: '2026-07-20', word: true, prayer: true, fast: null, record: false },
      { date: '2026-07-21', word: false, prayer: true, fast: null, record: false },
      { date: '2026-07-22', word: true, prayer: false, fast: null, record: true },
    ],
    today: { date: '2026-07-22', word: true, prayer: false, fast: null, record: true },
    last_active: {
      word: '2026-07-22',
      prayer: '2026-07-21',
      fast: null,
      record: '2026-07-22',
    },
    chains: {
      word: { current: 3, longest: 9, graced_days: ['2026-07-21'] },
      prayer: { current: 2, longest: 4, graced_days: [] },
      fast: { current: 0, longest: 0, graced_days: [] },
      record: { current: 1, longest: 6, graced_days: [] },
      rhythm: { current: 3, longest: 11, graced_days: [] },
    },
    ...over,
  };
}

describe('parseLedger', () => {
  it('reads the whole payload', () => {
    const l = parseLedger(payload());
    expect(l.days).toHaveLength(3);
    expect(l.days[1]).toEqual({
      date: '2026-07-21',
      word: false,
      prayer: true,
      fast: null,
      record: false,
    });
    expect(l.lastActive.word).toBe('2026-07-22');
    expect(l.lastActive.fast).toBeNull();
    expect(l.chains.word).toEqual({ current: 3, longest: 9, gracedDays: ['2026-07-21'] });
    expect(l.chains.rhythm.longest).toBe(11);
  });

  it('keeps a fast day three-valued', () => {
    const l = parseLedger({
      days: [
        { date: '2026-07-20', fast: true },
        { date: '2026-07-21', fast: false },
        { date: '2026-07-22' },
        { date: '2026-07-23', fast: 'maybe' },
      ],
    });
    expect(l.days.map((d) => d.fast)).toEqual([true, false, null, null]);
  });

  it('drops rows with no usable date and junk graced days', () => {
    const l = parseLedger({
      days: [{ date: '2026-07-20', word: true }, { word: true }, null, 7, { date: 'soon' }],
      chains: { word: { current: 2, longest: 2, graced_days: ['2026-07-19', 'nope', 5, null] } },
    });
    expect(l.days).toHaveLength(1);
    expect(l.chains.word.gracedDays).toEqual(['2026-07-19']);
  });

  it('never reports a negative count', () => {
    const l = parseLedger({ chains: { word: { current: -3, longest: -1 } } });
    expect(l.chains.word).toEqual({ current: 0, longest: 0, gracedDays: [] });
  });

  it('answers junk with the empty ledger rather than throwing', () => {
    expect(parseLedger(null)).toEqual(EMPTY_LEDGER);
    expect(parseLedger('nope')).toEqual(EMPTY_LEDGER);
    expect(parseLedger([])).toEqual(EMPTY_LEDGER);
    expect(parseLedger({ error: 'Range exceeds 92 days' })).toEqual(EMPTY_LEDGER);
  });
});

describe('keptOn', () => {
  const day = { date: TODAY, word: true, prayer: false, fast: null, record: false };

  it('reads a discipline straight off the day', () => {
    expect(keptOn(day, 'word')).toBe(true);
    expect(keptOn(day, 'prayer')).toBe(false);
    expect(keptOn(day, 'fast')).toBeNull();
  });

  it('derives rhythm as the union the function itself uses', () => {
    expect(keptOn(day, 'rhythm')).toBe(true);
    expect(
      keptOn({ date: TODAY, word: false, prayer: false, fast: null, record: false }, 'rhythm'),
    ).toBe(false);
    expect(
      keptOn({ date: TODAY, word: false, prayer: false, fast: true, record: false }, 'rhythm'),
    ).toBe(true);
    // A fast that was running and was missed does not count as kept.
    expect(
      keptOn({ date: TODAY, word: false, prayer: false, fast: false, record: false }, 'rhythm'),
    ).toBe(false);
  });

  it('is null for a day with no data', () => {
    expect(keptOn(undefined, 'word')).toBeNull();
    expect(keptOn(undefined, 'rhythm')).toBeNull();
  });
});

describe('chainChip', () => {
  const ledger = parseLedger(payload());

  it('carries the chain count and draws the Monday to Sunday week', () => {
    const chip = chainChip(ledger, 'word', TODAY);
    expect(chip?.current).toBe(3);
    expect(chip?.longest).toBe(9);
    expect(chip?.dots).toHaveLength(7);
    expect(chip?.dots.map((d) => d.date)).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26',
    ]);
  });

  it('classes each dot by what the day actually was', () => {
    const chip = chainChip(ledger, 'word', TODAY);
    // Mon kept, Tue missed but graced, Wed kept, Thu onward not yet lived.
    expect(chip?.dots.map((d) => d.cls)).toEqual([
      'filled',
      'graced',
      'filled',
      'dim',
      'dim',
      'dim',
      'dim',
    ]);
    expect(chip?.dots[1]?.label).toBe('G');
    expect(chip?.dots[0]?.label).toBe('');
  });

  it('marks a plain miss as missed, not dim', () => {
    const chip = chainChip(ledger, 'prayer', TODAY);
    expect(chip?.dots[2]?.cls).toBe('missed');
  });

  it('says the rhythm held when today is kept', () => {
    expect(chainChip(ledger, 'word', TODAY)?.state).toBe('The rhythm held.');
    expect(chainChip(ledger, 'word', TODAY)?.showVerse).toBe(false);
  });

  it('names the day mercy covered, today before yesterday', () => {
    const graced = parseLedger(
      payload({
        days: [
          { date: '2026-07-21', word: false },
          { date: '2026-07-22', word: false },
        ],
        chains: { word: { current: 4, longest: 4, graced_days: ['2026-07-21', '2026-07-22'] } },
      }),
    );
    expect(chainChip(graced, 'word', TODAY)?.state).toBe('Mercy covered Wednesday.');

    const yesterdayOnly = parseLedger(
      payload({
        days: [{ date: '2026-07-22', word: false }],
        chains: { word: { current: 4, longest: 4, graced_days: ['2026-07-21'] } },
      }),
    );
    expect(chainChip(yesterdayOnly, 'word', TODAY)?.state).toBe('Mercy covered Tuesday.');
  });

  it('invites the steward back with the verse after a real miss', () => {
    const missed = parseLedger(
      payload({
        days: [
          { date: '2026-07-21', word: false },
          { date: '2026-07-22', word: false },
        ],
        chains: { word: { current: 0, longest: 5, graced_days: [] } },
      }),
    );
    const chip = chainChip(missed, 'word', TODAY);
    expect(chip?.state).toBe('Pick it back up. His mercies are new in the morning.');
    expect(chip?.showVerse).toBe(true);
  });

  it('does not scold a steward who has no fast running', () => {
    // Every fast day is null, so nothing was missed and nothing is claimed.
    const chip = chainChip(ledger, 'fast', TODAY);
    expect(chip?.state).toBe('The rhythm held.');
    expect(chip?.showVerse).toBe(false);
    expect(chip?.dots.every((d) => d.cls === 'dim')).toBe(true);
  });

  it('draws real rhythm dots instead of the live app seven blanks', () => {
    const chip = chainChip(ledger, 'rhythm', TODAY);
    expect(chip?.current).toBe(3);
    expect(chip?.dots.slice(0, 3).map((d) => d.cls)).toEqual(['filled', 'filled', 'filled']);
  });

  it('is null when the day is not a day', () => {
    expect(chainChip(ledger, 'word', 'someday')).toBeNull();
  });

  it('draws an empty week rather than nothing when there is no ledger yet', () => {
    const chip = chainChip(EMPTY_LEDGER, 'rhythm', TODAY);
    expect(chip?.current).toBe(0);
    expect(chip?.dots.every((d) => d.cls === 'dim')).toBe(true);
    expect(chip?.state).toBe('The rhythm held.');
  });
});

describe('keptToday', () => {
  it('counts only the four disciplines actually kept', () => {
    expect(keptToday(parseLedger(payload()), TODAY)).toBe(2);
  });

  it('does not count a null fast as kept', () => {
    const l = parseLedger({
      days: [{ date: TODAY, word: true, prayer: true, fast: null, record: true }],
    });
    expect(keptToday(l, TODAY)).toBe(3);
  });

  it('counts all four', () => {
    const l = parseLedger({
      days: [{ date: TODAY, word: true, prayer: true, fast: true, record: true }],
    });
    expect(keptToday(l, TODAY)).toBe(4);
  });

  it('is zero when today is not in the range', () => {
    expect(keptToday(parseLedger(payload()), '2026-09-01')).toBe(0);
    expect(keptToday(EMPTY_LEDGER, TODAY)).toBe(0);
  });
});

describe('keptTodayLine', () => {
  it('spells the number out, as the live app did', () => {
    expect(keptTodayLine(0)).toBe('Zero of four disciplines kept today');
    expect(keptTodayLine(2)).toBe('Two of four disciplines kept today');
    expect(keptTodayLine(4)).toBe('Four of four disciplines kept today');
  });

  it('clamps rather than printing undefined', () => {
    expect(keptTodayLine(9)).toBe('Four of four disciplines kept today');
    expect(keptTodayLine(-1)).toBe('Zero of four disciplines kept today');
    expect(keptTodayLine(Number.NaN)).toBe('Zero of four disciplines kept today');
  });
});

describe('quietState', () => {
  it('welcomes a discipline that has never been touched', () => {
    const s = quietState('word', null, TODAY, false);
    expect(s.state).toBe('quiet');
    expect(s.label).toBe('Resting');
    expect(s.line).toBe('The Word is waiting for its first reading.');
    expect(quietState('record', null, TODAY, false).line).toBe(
      'The Record is waiting for its first entry.',
    );
  });

  it('is warm today and yesterday and says which', () => {
    expect(quietState('word', '2026-07-22', TODAY, false)).toEqual({
      state: 'warm',
      opacity: 1,
      label: 'Last entry: today',
      line: '',
    });
    expect(quietState('word', '2026-07-21', TODAY, false).label).toBe('Last entry: yesterday');
  });

  it('calls the fast a report, not an entry', () => {
    expect(quietState('fast', '2026-07-22', TODAY, true).label).toBe('Last report: today');
    expect(quietState('fast', '2026-07-19', TODAY, true).label).toBe('Last report: 3 days ago');
  });

  it('cools at two and three days without nagging', () => {
    const s = quietState('prayer', '2026-07-20', TODAY, false);
    expect(s.state).toBe('cooling');
    expect(s.opacity).toBe(0.6);
    expect(s.label).toBe('Last entry: 2 days ago');
    expect(s.line).toBe('');
  });

  it('rests and invites at four days, singular and plural handled', () => {
    const s = quietState('prayer', '2026-07-18', TODAY, false);
    expect(s.state).toBe('quiet');
    expect(s.line).toBe('Prayer has been quiet 4 days. Lift someone up today?');
    expect(quietState('word', '2026-06-22', TODAY, false).line).toContain('quiet 30 days');
  });

  it('does not ask for a fast report when no fast is running', () => {
    expect(quietState('fast', '2026-07-10', TODAY, false).line).toBe('');
    expect(quietState('fast', '2026-07-10', TODAY, true).line).toBe(
      'Your fast report has been quiet 12 days. Mark tonight?',
    );
  });

  it('treats a future last-active date as today rather than going negative', () => {
    expect(quietState('word', '2026-08-01', TODAY, false).label).toBe('Last entry: today');
  });

  it('falls back to the first-time line on an unparseable date', () => {
    expect(quietState('word', '2026-07-22', 'someday', false).line).toBe(
      'The Word is waiting for its first reading.',
    );
  });
});

describe('DISCIPLINE_CARDS', () => {
  it('is the four disciplines in the live app order, each with a route', () => {
    expect(DISCIPLINE_CARDS.map((c) => c.key)).toEqual(['word', 'prayer', 'fast', 'record']);
    expect(DISCIPLINE_CARDS.map((c) => c.href)).toEqual(['/bible', '/prayer', '/fast', '/record']);
    expect(DISCIPLINE_CARDS.map((c) => c.label)).toEqual([
      'The Word',
      'Prayer',
      'The Fast',
      'My Journal',
    ]);
  });
});
