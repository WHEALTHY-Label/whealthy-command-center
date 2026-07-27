import { describe, expect, it } from 'vitest';
import {
  WALL_DEAD_LINK,
  editHoursLeft,
  parseWallList,
  parseWallPost,
  pinnedNotice,
  relativeTime,
  testimonyTrack,
} from './wall';

// Fixtures mirror the deployed wall-read serializer field names.
const LIVE = {
  id: 42,
  body: 'Carry this with me.',
  status: 'live',
  pray_count: 4,
  amen_count: 0,
  created_at: '2026-07-20T10:00:00Z',
  answered_at: null,
  answered_note: null,
  answered_note_locked_at: null,
  display_mode: 'anonymous',
  is_mine: false,
  pray_count_frozen: false,
  prays_remaining_today: 2,
  author: { name: 'A Steward', avatar_url: null },
};

describe('parseWallPost', () => {
  it('reads the deployed serializer field names', () => {
    const p = parseWallPost(LIVE)!;
    expect(p.id).toBe('42');
    expect(p.prayCount).toBe(4);
    expect(p.praysRemainingToday).toBe(2);
    expect(p.displayMode).toBe('anonymous');
    expect(p.authorName).toBe('A Steward');
    expect(p.isMine).toBe(false);
  });

  it('reads an answered post with its amen state', () => {
    const p = parseWallPost({
      ...LIVE,
      status: 'answered',
      answered_at: '2026-07-22T10:00:00Z',
      answered_note: 'He provided.',
      answered_note_locked_at: '2026-07-23T10:00:00Z',
      pray_count_frozen: true,
      has_amened: true,
      amen_count: 7,
    })!;
    expect(p.status).toBe('answered');
    expect(p.prayCountFrozen).toBe(true);
    expect(p.hasAmened).toBe(true);
    expect(p.amenCount).toBe(7);
  });

  it('defaults prays remaining to the daily cap when the field is absent', () => {
    const rest: Record<string, unknown> = { ...LIVE };
    delete rest.prays_remaining_today;
    expect(parseWallPost(rest)!.praysRemainingToday).toBe(3);
  });

  it('rejects shapes without an id', () => {
    expect(parseWallPost({ body: 'x' })).toBeNull();
    expect(parseWallPost(null)).toBeNull();
  });
});

describe('parseWallList', () => {
  it('unwraps {posts} and drops malformed rows', () => {
    expect(parseWallList({ posts: [LIVE, { nope: true }] })).toHaveLength(1);
    expect(parseWallList({})).toEqual([]);
    expect(parseWallList(null)).toEqual([]);
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-07-22T12:00:00Z');
  it('matches the live app buckets', () => {
    expect(relativeTime('2026-07-22T11:59:40Z', now)).toBe('just now');
    expect(relativeTime('2026-07-22T11:15:00Z', now)).toBe('45m ago');
    expect(relativeTime('2026-07-22T07:00:00Z', now)).toBe('5h ago');
    expect(relativeTime('2026-07-19T12:00:00Z', now)).toBe('3d ago');
  });
});

describe('testimonyTrack', () => {
  // The live app spelled the month out and floored the elapsed days
  // (index.html:6269-6277). The port had abbreviated and rounded, so a prayer
  // answered forty hours later read "2 days" where the live app said "1 day".
  it('formats the asked/answered elapsed line with long months', () => {
    expect(testimonyTrack('2026-07-03T08:00:00Z', '2026-07-09T08:00:00Z')).toBe(
      'Asked July 3 · Answered July 9 · 6 days',
    );
  });

  it('floors the elapsed days rather than rounding', () => {
    expect(testimonyTrack('2026-07-03T08:00:00Z', '2026-07-05T00:00:00Z')).toContain('· 1 day');
    expect(testimonyTrack('2026-07-03T08:00:00Z', '2026-07-06T07:00:00Z')).toContain('· 2 days');
  });

  it('calls anything under a day the same day', () => {
    expect(testimonyTrack('2026-07-03T08:00:00Z', '2026-07-03T18:00:00Z')).toContain('Same day');
  });

  it('returns nothing when either end of the track is missing', () => {
    expect(testimonyTrack(null, '2026-07-09T08:00:00Z')).toBe('');
    expect(testimonyTrack('2026-07-03T08:00:00Z', null)).toBe('');
    expect(testimonyTrack('not-a-date', '2026-07-09T08:00:00Z')).toBe('');
  });
});

describe('pinnedNotice', () => {
  // The shared-link slot (index.html:5869-5875) refused to render a card for
  // anything that was not still live, and said why in each case.
  it('speaks for every non-live status', () => {
    expect(pinnedNotice('held')).toBe('This prayer is under review.');
    expect(pinnedNotice('archived')).toBe(
      'This prayer has left the wall. It was carried for 30 days.',
    );
    expect(pinnedNotice('answered')).toBe('This prayer was answered.');
  });

  it('stays silent for a live prayer so the card renders', () => {
    expect(pinnedNotice('live')).toBeNull();
  });

  it('names the dead link the way the live app did', () => {
    expect(WALL_DEAD_LINK).toBe('This prayer is no longer on the wall.');
  });
});

describe('editHoursLeft', () => {
  const now = Date.parse('2026-07-22T12:00:00Z');
  it('counts down and clamps at zero', () => {
    expect(editHoursLeft('2026-07-22T18:30:00Z', now)).toBe(7);
    expect(editHoursLeft('2026-07-22T11:00:00Z', now)).toBe(0);
    expect(editHoursLeft(null, now)).toBe(0);
  });
});
