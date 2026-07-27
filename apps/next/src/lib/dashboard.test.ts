import { describe, expect, it } from 'vitest';
import {
  activeFastDay,
  bundleState,
  firstStepsProgress,
  governorView,
  parseGovernorFast,
  parseWallCommunity,
  selectDirective,
  wallGarnish,
  EMPTY_WALL_COMMUNITY,
  FIRST_STEPS,
} from './dashboard';

describe('selectDirective', () => {
  it('uses the fast-phase line during an active fast', () => {
    expect(selectDirective({ fast: { day: 3, duration: 40, phase: 'deep work' } })).toBe(
      'Day 3 of 40 · deep work',
    );
  });

  it('omits the phase when absent', () => {
    expect(selectDirective({ fast: { day: 1, duration: 21 } })).toBe('Day 1 of 21');
  });

  it('falls back to the AI directive when not fasting', () => {
    expect(selectDirective({ fast: null, aiDirective: 'Protect the morning.' })).toBe(
      'Protect the morning.',
    );
  });

  it('uses the steady fallback when there is neither', () => {
    expect(selectDirective({})).toBe('Govern the day.');
    expect(selectDirective({ aiDirective: '   ' })).toBe('Govern the day.');
  });

  it('ignores a malformed fast (zero duration)', () => {
    expect(selectDirective({ fast: { day: 1, duration: 0 }, aiDirective: 'Steady.' })).toBe(
      'Steady.',
    );
  });
});

describe('firstStepsProgress', () => {
  it('counts done flags and finds the next step', () => {
    const p = firstStepsProgress({ bundle: true, word: true });
    expect(p.total).toBe(7);
    expect(p.done).toBe(2);
    expect(p.nextHref).toBe('/wall');
    expect(p.steps).toHaveLength(7);
  });

  it('handles no flags', () => {
    const p = firstStepsProgress(undefined);
    expect(p.done).toBe(0);
    expect(p.nextHref).toBe(FIRST_STEPS[0].href);
  });

  it('reports complete when all seven are set', () => {
    const all = Object.fromEntries(FIRST_STEPS.map((s) => [s.key, true]));
    const p = firstStepsProgress(all);
    expect(p.done).toBe(7);
    expect(p.nextHref).toBeNull();
  });
});

describe('bundleState', () => {
  it('reads name and claimed', () => {
    expect(bundleState({ bundle: { name: 'Boss + Hydration' }, bundle_claimed: true })).toEqual({
      name: 'Boss + Hydration',
      claimed: true,
    });
  });

  it('defaults to unclaimed with no name', () => {
    expect(bundleState({})).toEqual({ name: null, claimed: false });
  });
});

describe('parseWallCommunity', () => {
  it('reads the four counts the community scope returns', () => {
    expect(
      parseWallCommunity({
        scope: 'community',
        live_post_count: 12,
        prays_last_24h: 47,
        answered_last_7d: 3,
        top_post_pray_count: 19,
      }),
    ).toEqual({ livePosts: 12, praysLast24h: 47, answeredLast7d: 3, topPostPrayCount: 19 });
  });

  it('reads a payload with nothing on it as all zeros', () => {
    expect(parseWallCommunity({})).toEqual(EMPTY_WALL_COMMUNITY);
  });

  it('survives a payload that is not an object', () => {
    // The function is the last line of defence between an edge function having
    // a bad day and a blank dashboard.
    for (const bad of [null, undefined, 'community', 0, []]) {
      expect(parseWallCommunity(bad)).toEqual(EMPTY_WALL_COMMUNITY);
    }
  });

  it('refuses negative, non-finite, and non-numeric counts', () => {
    expect(
      parseWallCommunity({
        live_post_count: -4,
        prays_last_24h: Number.NaN,
        answered_last_7d: Number.POSITIVE_INFINITY,
        top_post_pray_count: '19',
      }),
    ).toEqual(EMPTY_WALL_COMMUNITY);
  });

  it('floors a fractional count rather than printing a decimal prayer', () => {
    expect(parseWallCommunity({ live_post_count: 2.9 }).livePosts).toBe(2);
  });
});

describe('wallGarnish', () => {
  const c = (over: Partial<typeof EMPTY_WALL_COMMUNITY> = {}) => ({
    ...EMPTY_WALL_COMMUNITY,
    ...over,
  });

  it('invites rather than reporting when every count is zero', () => {
    expect(wallGarnish(EMPTY_WALL_COMMUNITY)).toBe('The wall is quiet. Yours can be the first.');
  });

  it('joins all three clauses when all three have something to say', () => {
    expect(wallGarnish(c({ livePosts: 12, praysLast24h: 47, answeredLast7d: 3 }))).toBe(
      '12 prayers on the wall · 47 carries today · 3 answers this week.',
    );
  });

  it('says one of a thing in the singular', () => {
    expect(wallGarnish(c({ livePosts: 1, praysLast24h: 1, answeredLast7d: 1 }))).toBe(
      '1 prayer on the wall · 1 carry today · 1 answer this week.',
    );
  });

  it('drops a clause entirely rather than printing a zero', () => {
    expect(wallGarnish(c({ livePosts: 5 }))).toBe('5 prayers on the wall.');
    expect(wallGarnish(c({ answeredLast7d: 2 }))).toBe('2 answers this week.');
    expect(wallGarnish(c({ livePosts: 5, answeredLast7d: 2 }))).toBe(
      '5 prayers on the wall · 2 answers this week.',
    );
  });

  it('ignores the top-post count, which this line never speaks', () => {
    // It comes back on the payload and is parsed, but naming the most-prayed-for
    // prayer on a dashboard would point at someone. The card stays aggregate.
    expect(wallGarnish(c({ topPostPrayCount: 99 }))).toBe(
      'The wall is quiet. Yours can be the first.',
    );
  });
});

describe('activeFastDay', () => {
  it('counts the start date as day 1', () => {
    expect(
      activeFastDay({ status: 'active', start_date: '2026-07-22', duration: 40 }, '2026-07-22'),
    ).toBe(1);
    expect(
      activeFastDay({ status: 'active', start_date: '2026-07-22', duration: 40 }, '2026-07-24'),
    ).toBe(3);
  });

  it('accepts a full timestamp for start_date', () => {
    expect(
      activeFastDay(
        { status: 'active', start_date: '2026-07-22T00:00:00+00:00', duration: 40 },
        '2026-07-23',
      ),
    ).toBe(2);
  });

  it('ignores a fast that is not active', () => {
    expect(
      activeFastDay({ status: 'complete', start_date: '2026-07-22', duration: 40 }, '2026-07-23'),
    ).toBeNull();
  });

  it('returns null before the start and after the duration runs out', () => {
    const fast = { status: 'active', start_date: '2026-07-22', duration: 3 };
    expect(activeFastDay(fast, '2026-07-21')).toBeNull();
    expect(activeFastDay(fast, '2026-07-26')).toBeNull();
  });

  it('keeps counting when duration is missing', () => {
    expect(activeFastDay({ status: 'active', start_date: '2026-07-01' }, '2026-07-22')).toBe(22);
  });

  it('rejects a malformed date on either side', () => {
    expect(
      activeFastDay({ status: 'active', start_date: 'soon', duration: 40 }, '2026-07-22'),
    ).toBeNull();
    expect(
      activeFastDay({ status: 'active', start_date: '2026-07-22', duration: 40 }, 'today'),
    ).toBeNull();
  });
});

describe('parseGovernorFast', () => {
  // Shaped like the raw `fasts` row governor-state returns, verbatim.
  const row = {
    status: 'active',
    start_date: '2026-07-20',
    duration: 40,
    plan: {
      phases: [
        { name: 'Break In', from: 1, to: 7 },
        { name: 'Deep Work', from: 8, to: 40 },
      ],
      focus: {
        'Break In': ['Hold the morning.', 'Water first.'],
        'Deep Work': ['One block, no phone.'],
      },
    },
  };

  it('computes the day and picks the phase line for it', () => {
    expect(parseGovernorFast(row, '2026-07-20')).toEqual({
      day: 1,
      duration: 40,
      phase: 'Hold the morning.',
    });
  });

  it('cycles the focus list by day inside a phase', () => {
    expect(parseGovernorFast(row, '2026-07-21')?.phase).toBe('Water first.');
    expect(parseGovernorFast(row, '2026-07-22')?.phase).toBe('Hold the morning.');
  });

  it('reads the second phase once the day crosses into it', () => {
    expect(parseGovernorFast(row, '2026-07-27')).toEqual({
      day: 8,
      duration: 40,
      phase: 'One block, no phone.',
    });
  });

  it('falls back to the steady line when the phase has no focus copy', () => {
    const noFocus = { ...row, plan: { phases: row.plan.phases, focus: {} } };
    expect(parseGovernorFast(noFocus, '2026-07-20')?.phase).toBe('Full routine. No exceptions.');
  });

  it('returns null for a fast with no plan, matching the live gate', () => {
    expect(
      parseGovernorFast({ status: 'active', start_date: '2026-07-20', duration: 40 }, '2026-07-20'),
    ).toBeNull();
  });

  it('returns null for a missing or zero duration', () => {
    expect(parseGovernorFast({ ...row, duration: 0 }, '2026-07-20')).toBeNull();
  });

  it('returns null for anything that is not a row', () => {
    expect(parseGovernorFast(null, '2026-07-20')).toBeNull();
    expect(parseGovernorFast('active', '2026-07-20')).toBeNull();
  });
});

describe('governorView', () => {
  const plan = {
    phases: [{ name: 'Entry', from: 1, to: 7 }],
    focus: { Entry: ['Hold the morning.'] },
  };

  it('reads nothing out of a load the function itself called a failure', () => {
    // `governor-state` answers a bad body with HTTP 200 {ok:false}, so the
    // flag is the only signal that the payload is empty.
    expect(governorView({ ok: false, directive: 'ignored' }, '2026-07-20')).toEqual({
      aiDirective: null,
      fast: null,
    });
  });

  it('reads nothing out of a null load', () => {
    expect(governorView(null, '2026-07-20')).toEqual({ aiDirective: null, fast: null });
  });

  it('prefers `directive` over `daily_directive`', () => {
    expect(
      governorView(
        { ok: true, directive: 'Govern the hour.', daily_directive: 'Older.' },
        '2026-07-20',
      ).aiDirective,
    ).toBe('Govern the hour.');
  });

  it('falls back to `daily_directive` when `directive` is absent or empty', () => {
    expect(governorView({ ok: true, daily_directive: 'Older.' }, '2026-07-20').aiDirective).toBe(
      'Older.',
    );
    expect(
      governorView({ ok: true, directive: '', daily_directive: 'Older.' }, '2026-07-20')
        .aiDirective,
    ).toBe('Older.');
  });

  it('answers null for a directive that is not a string', () => {
    expect(governorView({ ok: true, directive: 42 }, '2026-07-20').aiDirective).toBeNull();
  });

  it('hands the fast row to parseGovernorFast with the day it was given', () => {
    const raw = {
      ok: true,
      fast: { status: 'active', start_date: '2026-07-20', duration: 40, plan },
    };
    expect(governorView(raw, '2026-07-22').fast).toEqual({
      day: 3,
      duration: 40,
      phase: 'Hold the morning.',
    });
  });

  it('carries no fast when the row is missing', () => {
    expect(governorView({ ok: true, directive: 'Govern the day.' }, '2026-07-20').fast).toBeNull();
  });
});
