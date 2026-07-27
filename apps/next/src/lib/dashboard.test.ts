import { describe, expect, it } from 'vitest';
import {
  bundleState,
  firstStepsProgress,
  parseWallCommunity,
  selectDirective,
  wallGarnish,
  EMPTY_WALL_COMMUNITY,
  FIRST_STEPS,
} from './dashboard';

describe('selectDirective', () => {
  it('uses the fast-phase line during an active fast', () => {
    expect(selectDirective({ fast: { day: 3, duration: 40, phase: 'deep work' } })).toBe(
      'Day 3 of 40, deep work',
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
