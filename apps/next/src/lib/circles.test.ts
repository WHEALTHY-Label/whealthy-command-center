import { describe, expect, it } from 'vitest';
import { parseCircleDay, parseCohortBoard } from './circles';

describe('parseCircleDay', () => {
  it('reads the deployed circle-day shape including the null fast state', () => {
    const day = parseCircleDay({
      circle: 'Iron Circle',
      circle_id: 9,
      invite_code: 'ABC234',
      today: '2026-07-22',
      members: [
        { member_id: 1, name: 'Jake T', role: 'shepherd', word: true, prayer: false, fast: null, record: true, i_prayed_count: 2 },
        { member_id: 2, name: 'Sam R', role: 'member', word: false, prayer: true, fast: true, record: false, i_prayed_count: 3 },
      ],
    })!;
    expect(day.name).toBe('Iron Circle');
    expect(day.inviteCode).toBe('ABC234');
    expect(day.members[0]!.fast).toBeNull();
    expect(day.members[1]!.fast).toBe(true);
    expect(day.members[1]!.iPrayedCount).toBe(3);
  });

  it('answers null when the member is in no circle', () => {
    expect(parseCircleDay({ circle: null })).toBeNull();
    expect(parseCircleDay(null)).toBeNull();
  });
});

describe('parseCohortBoard', () => {
  it('reads the deployed cohort-board shape', () => {
    const board = parseCohortBoard({
      cohort: 'Summer Fast 2026',
      day: 4,
      of: 21,
      status: 'open',
      members: [{ name: 'Jake T', days_kept: 3 }],
    })!;
    expect(board.day).toBe(4);
    expect(board.of).toBe(21);
    expect(board.members[0]!.daysKept).toBe(3);
  });

  it('answers null without a cohort', () => {
    expect(parseCohortBoard({})).toBeNull();
  });
});
