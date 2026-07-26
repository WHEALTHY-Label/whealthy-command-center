import { describe, expect, it } from 'vitest';
import type { Season } from './rhythm';
import {
  daysLeftLine,
  isSeasonLength,
  SEASON_LENGTHS,
  seasonOptions,
  seasonProgress,
  seasonView,
} from './season';

function season(partial: Partial<Season> = {}): Season {
  return { source: null, completed: false, canCommit: true, ...partial };
}

describe('SEASON_LENGTHS', () => {
  it('mirrors the lengths the edge function allows', () => {
    expect([...SEASON_LENGTHS]).toEqual([21, 40, 90]);
    expect(isSeasonLength(40)).toBe(true);
    expect(isSeasonLength(30)).toBe(false);
    expect(isSeasonLength('21')).toBe(false);
  });
});

describe('seasonOptions', () => {
  it('drops any offered length the server would reject', () => {
    expect(seasonOptions(season({ options: [21, 30, 90] }))).toEqual([21, 90]);
  });
  it('falls back to the known lengths when the list is missing or unusable', () => {
    expect(seasonOptions(season())).toEqual([21, 40, 90]);
    expect(seasonOptions(season({ options: [7] }))).toEqual([21, 40, 90]);
  });
});

describe('seasonProgress', () => {
  it('rounds and clamps', () => {
    expect(seasonProgress(1, 21)).toBe(5);
    expect(seasonProgress(21, 21)).toBe(100);
    expect(seasonProgress(25, 21)).toBe(100);
    expect(seasonProgress(undefined, 21)).toBe(0);
    expect(seasonProgress(4, 0)).toBe(0);
  });
});

describe('daysLeftLine', () => {
  it('counts days remaining and never mentions a streak', () => {
    expect(daysLeftLine(19)).toBe('19 days left');
    expect(daysLeftLine(1)).toBe('1 day left');
    expect(daysLeftLine(0)).toBe('Last day.');
    expect(daysLeftLine(undefined)).toBe('');
    for (const left of [19, 1, 0]) {
      expect(daysLeftLine(left)).not.toMatch(/streak|broke|fail|miss/i);
    }
  });
});

describe('seasonView', () => {
  it('offers a season only when nothing is running', () => {
    const view = seasonView(season({ options: [21, 40, 90] }));
    expect(view.kind).toBe('offer');
    if (view.kind === 'offer') expect(view.options).toEqual([21, 40, 90]);
  });

  it('shows a running rhythm season with progress and an end control', () => {
    const view = seasonView(
      season({
        source: 'rhythm',
        day: 4,
        total: 21,
        daysLeft: 17,
        label: 'Your 21-day rhythm',
        completed: false,
      }),
    );
    expect(view.kind).toBe('running');
    if (view.kind !== 'running') return;
    expect(view.label).toBe('Your 21-day rhythm');
    expect(view.percent).toBe(19);
    expect(view.leftLine).toBe('17 days left');
    expect(view.canEnd).toBe(true);
    expect(view.withCohort).toBe(false);
  });

  it('never offers to end a fast from the rhythm strip', () => {
    const view = seasonView(
      season({ source: 'fast', day: 3, total: 40, daysLeft: 37, cohortId: 'c1' }),
    );
    expect(view.kind).toBe('running');
    if (view.kind !== 'running') return;
    expect(view.canEnd).toBe(false);
    expect(view.withCohort).toBe(true);
    // With no label the fallback still names the length, never "day 3 streak".
    expect(seasonView(season({ source: 'fast', day: 3, total: 40 })).kind).toBe('running');
  });

  it('closes a finished season warmly', () => {
    const view = seasonView(season({ source: 'rhythm', day: 21, total: 21, completed: true }));
    expect(view.kind).toBe('complete');
    if (view.kind === 'complete') {
      expect(view.line).toBe('You finished your 21-day season. Well carried.');
      expect(view.canEnd).toBe(true);
    }
  });

  it('shows nothing when the function will not take a commit', () => {
    expect(seasonView(season({ canCommit: false })).kind).toBe('none');
  });

  it('does not read a running season as an invitation to start another', () => {
    // Once a season runs the function stops sending `can_commit` at all, so the
    // parsed default is true. Source has to win, or the offer reappears.
    expect(seasonView(season({ source: 'rhythm', day: 2, total: 40, canCommit: true })).kind).toBe(
      'running',
    );
  });
});
