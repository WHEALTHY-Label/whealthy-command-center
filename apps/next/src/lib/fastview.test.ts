import { describe, expect, it } from 'vitest';
import { anchorLines, deriveFastView } from './fastview';

const TODAY = '2026-07-22';

// The shape the builder actually writes: fast_model is an object and the
// display name lives on the plan.
const BUILT = {
  id: 'f1',
  status: 'active',
  fast_model: {
    id: 'daniel-mourning',
    title: "Daniel's 21 Days",
    figure: 'Daniel',
    refs: ['Daniel 10:2-3'],
  },
  duration: 21,
  start_date: '2026-07-19',
  laid: ['Evening scrolling'],
  whys: ['direction'],
  cohort_id: 7,
  anchors: { wake: '06:40', lights: '22:30', oz: 128, movement: true, laps: 2, journal: 5, prayer: true },
  plan: { fast_name: "DANIEL'S 21 DAYS" },
};

describe('deriveFastView', () => {
  it('reads an active fixed-length fast with a one-based day count', () => {
    const v = deriveFastView(BUILT, TODAY);
    expect(v.kind).toBe('active');
    expect(v.day).toBe(4);
    expect(v.duration).toBe(21);
    expect(v.name).toBe("DANIEL'S 21 DAYS");
    expect(v.cohortId).toBe('7');
    expect(v.laid).toEqual(['Evening scrolling']);
  });

  it('falls back through the model title, then a legacy string', () => {
    const noPlanName: Record<string, unknown> = { ...BUILT };
    delete noPlanName.plan;
    expect(deriveFastView(noPlanName, TODAY).name).toBe("Daniel's 21 Days");
    expect(
      deriveFastView({ status: 'active', fast_model: 'Daniel Fast' }, TODAY).name,
    ).toBe('Daniel Fast');
    expect(deriveFastView({ status: 'active' }, TODAY).name).toBe('Your Fast');
  });

  it('reads the anchors object into display lines', () => {
    expect(deriveFastView(BUILT, TODAY).anchors).toEqual([
      'Up by 6:40am',
      'Lights out by 10:30pm',
      '128 oz of hydration',
      'Morning movement',
      'Daily walk, 2 laps',
      'Journal 5 minutes',
      'Prayer, morning and night',
    ]);
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

describe('anchorLines', () => {
  it('leaves out anchors that were switched off', () => {
    expect(
      anchorLines({ wake: '06:40', lights: '22:00', oz: 0, movement: false, laps: 0, journal: 0, prayer: false }),
    ).toEqual(['Up by 6:40am', 'Lights out by 10:00pm']);
  });

  it('counts a single lap in the singular', () => {
    expect(anchorLines({ laps: 1 })).toEqual(['Daily walk, 1 lap']);
  });

  it('still accepts a list of lines', () => {
    expect(anchorLines(['Up by 6am', 42])).toEqual(['Up by 6am']);
    expect(anchorLines(null)).toEqual([]);
    expect(anchorLines('nope')).toEqual([]);
  });
});
