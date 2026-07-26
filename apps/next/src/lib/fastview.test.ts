import { describe, expect, it } from 'vitest';
import { deriveFastView } from './fastview';

const TODAY = '2026-07-22';

describe('deriveFastView', () => {
  it('reads an active fixed-length fast with a one-based day count', () => {
    const v = deriveFastView(
      {
        id: 'f1',
        status: 'active',
        fast_model: 'Daniel Fast',
        duration: 21,
        start_date: '2026-07-19',
        laid: ['Evening scrolling'],
        whys: ['Clarity'],
        cohort_id: 7,
        plan: {},
      },
      TODAY,
    );
    expect(v.kind).toBe('active');
    expect(v.day).toBe(4);
    expect(v.duration).toBe(21);
    expect(v.name).toBe('Daniel Fast');
    expect(v.cohortId).toBe('7');
    expect(v.laid).toEqual(['Evening scrolling']);
  });

  it('marks a fast past its last day as overrun rather than rewriting state', () => {
    const v = deriveFastView(
      { id: 'f1', status: 'active', duration: 3, start_date: '2026-07-10' },
      TODAY,
    );
    expect(v.kind).toBe('overrun');
    expect(v.day).toBeGreaterThan(3);
  });

  it('reads a closed fast and whether its report was filed', () => {
    const closed = deriveFastView(
      { id: 'f1', status: 'ended_early', ended_day: 5, plan: { report_filed: true } },
      TODAY,
    );
    expect(closed.kind).toBe('closed');
    expect(closed.endedDay).toBe(5);
    expect(closed.reportFiled).toBe(true);
  });

  it('treats missing or discarded fasts as none', () => {
    expect(deriveFastView(null, TODAY).kind).toBe('none');
    expect(deriveFastView({ status: 'discarded' }, TODAY).kind).toBe('none');
  });
});
