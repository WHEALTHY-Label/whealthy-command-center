import { describe, expect, it } from 'vitest';
import {
  broughtPrayerToday,
  day365,
  parseMarks,
  parsePassage,
  parseProgressRow,
  streak365,
} from './bible';
import { READINGS } from './data/readings365';
import { BIBLE_BOOKS } from './data/bibleBooks';

describe('parsePassage', () => {
  it('reads the deployed bible-verses shape', () => {
    const p = parsePassage({
      reference: 'John 3:16',
      verses: [{ book_name: 'John', chapter: 3, verse: 16, text: 'For God so loved the world...' }],
      text: 'For God so loved the world...',
      translation_id: 'BSB',
    })!;
    expect(p.reference).toBe('John 3:16');
    expect(p.verses[0]!.book).toBe('John');
    expect(p.verses[0]!.verse).toBe(16);
  });
  it('rejects junk', () => {
    expect(parsePassage({ error: 'nope' })).toBeNull();
    expect(parsePassage(null)).toBeNull();
  });
});

describe('parseMarks', () => {
  it('reads highlights and notes and drops unknown kinds', () => {
    const marks = parseMarks({
      ok: true,
      marks: [
        {
          id: 1,
          book: 'John',
          chapter: 3,
          verse: 16,
          kind: 'highlight',
          body: null,
          created_at: 'x',
        },
        {
          id: 2,
          book: 'John',
          chapter: 3,
          verse: 17,
          kind: 'note',
          body: 'Hold this.',
          created_at: 'x',
        },
        { id: 3, book: 'John', chapter: 3, verse: 18, kind: 'weird', body: null, created_at: 'x' },
      ],
    });
    expect(marks).toHaveLength(2);
    expect(marks[1]!.body).toBe('Hold this.');
  });
});

describe('day365', () => {
  it('is calendar-driven and clamped 1-365', () => {
    expect(day365('2026-07-19', '2026-07-22')).toBe(4);
    expect(day365('2026-07-22', '2026-07-22')).toBe(1);
    expect(day365('2020-01-01', '2026-07-22')).toBe(365);
    expect(day365('2027-01-01', '2026-07-22')).toBe(1);
  });
});

describe('streak365', () => {
  it('counts consecutive days back from today, tolerating an unread today', () => {
    expect(streak365([1, 2, 3, 4], 4)).toBe(4);
    expect(streak365([1, 2, 3], 4)).toBe(3);
    expect(streak365([1, 3], 4)).toBe(1);
    expect(streak365([], 4)).toBe(0);
  });
});

describe('parseProgressRow', () => {
  it('reads the bible_progress row', () => {
    const p = parseProgressRow({ start_date: '2026-07-01', completed_days: [1, 2], streak: 2 })!;
    expect(p.startDate).toBe('2026-07-01');
    expect(p.completed).toEqual([1, 2]);
  });
  it('is null before the study begins', () => {
    expect(parseProgressRow(null)).toBeNull();
    expect(parseProgressRow({})).toBeNull();
  });
});

describe('broughtPrayerToday', () => {
  const at = (createdAt: string | null) => ({ createdAt });

  it("is true when one of the member's own posts carries today", () => {
    expect(
      broughtPrayerToday([at('2026-07-20T09:00:00Z'), at('2026-07-22T14:00:00Z')], '2026-07-22'),
    ).toBe(true);
  });

  it('still counts a prayer brought in the evening', () => {
    // 8pm Chicago is already tomorrow in UTC. Comparing the raw UTC date is
    // what made a steward's own prayer fail to check its task off after 7pm,
    // every evening.
    expect(broughtPrayerToday([at('2026-07-23T01:00:00Z')], '2026-07-22')).toBe(true);
  });

  it('is false when the most recent prayer was yesterday', () => {
    // The task resets with the Chicago calendar day, the same boundary Day N of
    // 365 turns over on. 23:59Z is still 6:59pm the previous evening here.
    expect(broughtPrayerToday([at('2026-07-21T23:59:00Z')], '2026-07-22')).toBe(false);
    expect(broughtPrayerToday([at('2026-07-22T02:14:00Z')], '2026-07-22')).toBe(false);
    expect(broughtPrayerToday([at('2026-07-22T02:14:00Z')], '2026-07-21')).toBe(true);
  });

  it('is false with no prayers at all', () => {
    expect(broughtPrayerToday([], '2026-07-22')).toBe(false);
  });

  it('ignores posts with a missing or unparseable timestamp', () => {
    expect(broughtPrayerToday([at(null), at('not a date')], '2026-07-22')).toBe(false);
  });

  it('refuses a malformed today rather than guessing at it', () => {
    expect(broughtPrayerToday([at('2026-07-22T02:14:00Z')], 'today')).toBe(false);
    expect(broughtPrayerToday([at('2026-07-22T02:14:00Z')], '')).toBe(false);
  });
});

describe('shipped plan data', () => {
  it('carries all 365 readings and all 66 books', () => {
    expect(READINGS).toHaveLength(365);
    expect(READINGS[0]!.ref).toBe('Genesis 1-3');
    expect(READINGS[364]!.ref).toBe('Revelation 12-22');
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(BIBLE_BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(1189);
  });
});
