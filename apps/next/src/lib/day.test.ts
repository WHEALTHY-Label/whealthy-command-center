import { describe, expect, it } from 'vitest';
import { addDaysIso, chicagoDate, dayName, daysBetween, isIsoDate, mondayOf, weekOf } from './day';

describe('chicagoDate', () => {
  it('is the Chicago calendar day, not the UTC one', () => {
    // 2026-07-23T02:30:00Z is still the evening of the 22nd in Chicago (CDT).
    expect(chicagoDate(Date.parse('2026-07-23T02:30:00Z'))).toBe('2026-07-22');
    expect(new Date(Date.parse('2026-07-23T02:30:00Z')).toISOString().slice(0, 10)).toBe(
      '2026-07-23',
    );
  });

  it('rolls over at Chicago midnight', () => {
    expect(chicagoDate(Date.parse('2026-07-23T04:59:00Z'))).toBe('2026-07-22');
    expect(chicagoDate(Date.parse('2026-07-23T05:00:00Z'))).toBe('2026-07-23');
  });

  it('holds through the winter offset too', () => {
    // CST is UTC-6, so the boundary moves an hour later in January.
    expect(chicagoDate(Date.parse('2026-01-15T05:59:00Z'))).toBe('2026-01-14');
    expect(chicagoDate(Date.parse('2026-01-15T06:00:00Z'))).toBe('2026-01-15');
  });

  it('zero pads and refuses junk', () => {
    expect(chicagoDate(Date.parse('2026-03-05T18:00:00Z'))).toBe('2026-03-05');
    expect(chicagoDate(Number.NaN)).toBe('');
    expect(chicagoDate(Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('isIsoDate', () => {
  it('accepts a date and rejects everything else', () => {
    expect(isIsoDate('2026-07-22')).toBe(true);
    expect(isIsoDate('2026-7-22')).toBe(false);
    expect(isIsoDate('2026-07-22T00:00:00Z')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
  });
});

describe('addDaysIso', () => {
  it('walks forward and back across month and year ends', () => {
    expect(addDaysIso('2026-07-22', 1)).toBe('2026-07-23');
    expect(addDaysIso('2026-07-22', -1)).toBe('2026-07-21');
    expect(addDaysIso('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysIso('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysIso('2026-07-22', 0)).toBe('2026-07-22');
  });

  it('crosses a daylight saving boundary without losing a day', () => {
    // US DST began 2026-03-08. Fourteen days back from the 15th is the 1st.
    expect(addDaysIso('2026-03-15', -14)).toBe('2026-03-01');
    expect(addDaysIso('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDaysIso('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('handles a leap day', () => {
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysIso('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('returns nothing for junk rather than a wrong date', () => {
    expect(addDaysIso('nope', 1)).toBe('');
    expect(addDaysIso('2026-07-22', Number.NaN)).toBe('');
  });
});

describe('mondayOf', () => {
  it('treats Sunday as the end of its week, not the start of the next', () => {
    // 2026-07-22 is a Wednesday; that week runs Mon 20 to Sun 26.
    expect(mondayOf('2026-07-20')).toBe('2026-07-20');
    expect(mondayOf('2026-07-22')).toBe('2026-07-20');
    expect(mondayOf('2026-07-26')).toBe('2026-07-20');
    expect(mondayOf('2026-07-27')).toBe('2026-07-27');
  });

  it('reaches back into the previous month', () => {
    expect(mondayOf('2026-08-02')).toBe('2026-07-27');
  });

  it('returns nothing for junk', () => {
    expect(mondayOf('later')).toBe('');
  });
});

describe('daysBetween', () => {
  it('counts whole days in both directions', () => {
    expect(daysBetween('2026-07-20', '2026-07-22')).toBe(2);
    expect(daysBetween('2026-07-22', '2026-07-20')).toBe(-2);
    expect(daysBetween('2026-07-22', '2026-07-22')).toBe(0);
    expect(daysBetween('2026-03-01', '2026-03-15')).toBe(14);
  });

  it('is null when either end is junk', () => {
    expect(daysBetween('nope', '2026-07-22')).toBeNull();
    expect(daysBetween('2026-07-22', '')).toBeNull();
  });
});

describe('dayName', () => {
  it('names the weekday', () => {
    expect(dayName('2026-07-20')).toBe('Monday');
    expect(dayName('2026-07-22')).toBe('Wednesday');
    expect(dayName('2026-07-26')).toBe('Sunday');
  });

  it('returns nothing for junk', () => {
    expect(dayName('someday')).toBe('');
  });
});

describe('weekOf', () => {
  it('is the seven dates Monday through Sunday', () => {
    expect(weekOf('2026-07-22')).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26',
    ]);
  });

  it('starts on Monday whichever day is asked about', () => {
    expect(weekOf('2026-07-26')[0]).toBe('2026-07-20');
    expect(weekOf('2026-07-20')[6]).toBe('2026-07-26');
  });

  it('is empty for junk', () => {
    expect(weekOf('nope')).toEqual([]);
  });
});
