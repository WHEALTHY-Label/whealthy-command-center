import { describe, expect, it } from 'vitest';
import {
  buildAssessPayload,
  canAdvance,
  chronotypeOf,
  emptyAnswers,
  formatClock,
  nonNegotiableDomain,
  RMEQ_COUNT,
  RMEQ_QUESTIONS,
  rmeqScore,
  summaryLines,
  type AssessmentAnswers,
} from './assessment';

function answered(points: Array<number | null>): AssessmentAnswers {
  return { ...emptyAnswers(), rmeq: points };
}

describe('RMEQ_QUESTIONS', () => {
  it('is the validated 5-item instrument', () => {
    expect(RMEQ_QUESTIONS).toHaveLength(5);
    expect(RMEQ_COUNT).toBe(5);
    for (const q of RMEQ_QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('spans the documented 4-25 total range', () => {
    const min = RMEQ_QUESTIONS.reduce(
      (sum, q) => sum + Math.min(...q.options.map((o) => o.points)),
      0,
    );
    const max = RMEQ_QUESTIONS.reduce(
      (sum, q) => sum + Math.max(...q.options.map((o) => o.points)),
      0,
    );
    expect(min).toBe(4);
    expect(max).toBe(25);
  });
});

describe('rmeqScore', () => {
  it('sums a complete set', () => {
    expect(rmeqScore([5, 4, 5, 5, 6])).toBe(25);
  });
  it('is null while any answer is missing', () => {
    expect(rmeqScore([5, 4, null, 5, 6])).toBeNull();
    expect(rmeqScore([5, 4])).toBeNull();
  });
});

describe('chronotypeOf', () => {
  it('matches the edge function cutoffs', () => {
    expect(chronotypeOf(25)).toBe('morning');
    expect(chronotypeOf(18)).toBe('morning');
    expect(chronotypeOf(17)).toBe('intermediate');
    expect(chronotypeOf(12)).toBe('intermediate');
    expect(chronotypeOf(11)).toBe('evening');
    expect(chronotypeOf(4)).toBe('evening');
  });
  it('is null without a score', () => {
    expect(chronotypeOf(null)).toBeNull();
  });
});

describe('canAdvance', () => {
  it('holds each rMEQ step until it is answered', () => {
    const answers = answered([3, null, null, null, null]);
    expect(canAdvance('rmeq-0', answers)).toBe(true);
    expect(canAdvance('rmeq-1', answers)).toBe(false);
  });
  it('requires both clock times', () => {
    const answers = { ...emptyAnswers(), wakeTime: '06:00' };
    expect(canAdvance('clock', answers)).toBe(false);
    expect(canAdvance('clock', { ...answers, sleepTime: '22:00' })).toBe(true);
  });
  it('requires an accountability choice but never work or anchors', () => {
    const answers = emptyAnswers();
    expect(canAdvance('work', answers)).toBe(true);
    expect(canAdvance('anchors', answers)).toBe(true);
    expect(canAdvance('accountability', answers)).toBe(false);
    expect(canAdvance('accountability', { ...answers, accountability: 'self' })).toBe(true);
  });
});

describe('formatClock', () => {
  it('renders 24-hour input in the steward-facing form', () => {
    expect(formatClock('06:00')).toBe('6:00 am');
    expect(formatClock('00:30')).toBe('12:30 am');
    expect(formatClock('12:15')).toBe('12:15 pm');
    expect(formatClock('22:45')).toBe('10:45 pm');
  });
  it('passes through anything it cannot parse', () => {
    expect(formatClock('')).toBe('');
    expect(formatClock('nonsense')).toBe('nonsense');
  });
});

describe('summaryLines', () => {
  it('reflects the answers back without ever naming a score', () => {
    const lines = summaryLines({
      ...answered([5, 4, 5, 5, 6]),
      wakeTime: '05:30',
      sleepTime: '21:30',
      accountability: 'partner',
      fastingOptIn: true,
      fastingWindow: 'Wednesdays, sunrise to sundown',
    });
    const text = lines.join(' ');
    expect(text).toContain('5:30 am');
    expect(text).toContain('Wednesdays');
    expect(text).not.toMatch(/score|25|points/i);
  });
});

describe('buildAssessPayload', () => {
  it('maps to the edge function field names and drops empty entries', () => {
    const payload = buildAssessPayload({
      ...answered([5, 4, 3, 3, 4]),
      wakeTime: '06:00',
      sleepTime: '22:00',
      workStart: '09:00',
      workEnd: '17:00',
      workDays: [5, 1, 3],
      remote: true,
      nonNegotiables: [
        { label: 'The Word', when: 'before coffee' },
        { label: '   ', when: 'ignored' },
      ],
      familyAnchors: [
        { type: 'date_night', when: 'Friday 7pm' },
        { type: 'kids', when: '' },
      ],
      accountability: 'group',
    });
    expect(payload.rmeq_items).toEqual([5, 4, 3, 3, 4]);
    expect(payload.wake_time).toBe('06:00');
    expect(payload.work_shape.days).toEqual([1, 3, 5]);
    expect(payload.work_shape.remote).toBe(true);
    // `scripture`, not `custom`: rhythm-build looks the "Open the Word" cue up
    // by domain, so a mislabelled anchor loses the steward's own wording.
    expect(payload.non_negotiables).toEqual([
      { label: 'The Word', when: 'before coffee', domain: 'scripture' },
    ]);
    expect(payload.family_anchors).toHaveLength(1);
    expect(payload.accountability_pref).toBe('group');
    expect(payload.fasting_pref).toEqual({ opt_in: false, window: null });
  });

  it('nulls out clock fields that were never given', () => {
    const payload = buildAssessPayload(emptyAnswers());
    expect(payload.wake_time).toBeNull();
    expect(payload.sleep_time).toBeNull();
  });
});

describe('nonNegotiableDomain', () => {
  it('classifies a scripture anchor so rhythm-build finds it', () => {
    // rhythm-build looks its "Open the Word" cue up with
    // `.find(n => n.domain === "scripture")`. Miss, and the steward's own
    // wording is thrown away for the generic "after the morning cup".
    for (const label of [
      'The Word',
      'Bible',
      'Scripture reading',
      'Morning devotional',
      'A Psalm',
      'Quiet time',
      'Gospel',
    ]) {
      expect(nonNegotiableDomain(label)).toBe('scripture');
    }
  });

  it('classifies a prayer anchor so the evening check-in finds it', () => {
    for (const label of ['Prayer', 'Praying with my wife', 'Intercession', 'Evening prayers']) {
      expect(nonNegotiableDomain(label)).toBe('prayer');
    }
  });

  it('is case and spacing insensitive', () => {
    expect(nonNegotiableDomain('  THE WORD  ')).toBe('scripture');
    expect(nonNegotiableDomain('PRAYER')).toBe('prayer');
  });

  it('prefers prayer when a label mentions both', () => {
    expect(nonNegotiableDomain('Prayer and the Word')).toBe('prayer');
  });

  it('leaves anything else custom, which is the editor default', () => {
    for (const label of ['Gym', 'Cold plunge', 'Walk the dog', '', 'Wordle']) {
      expect(nonNegotiableDomain(label)).toBe('custom');
    }
  });
});
