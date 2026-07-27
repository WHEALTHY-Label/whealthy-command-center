import { describe, expect, it } from 'vitest';
import { parseReveal, splitPlanName } from './fastreveal';

/** A row shaped the way `composeFastRow` writes one. */
const row = (over: Record<string, unknown> = {}) => ({
  status: 'revealed',
  start_date: '2026-03-02',
  duration: 21,
  fast_model: { title: "DANIEL'S 21 DAYS", refs: ['Daniel 10:2-3', 'Daniel 1:12'] },
  anchors: { wake: '06:40', lights: '22:00', oz: 128 },
  exclusions: [],
  product_state: 'equipped',
  plan: {
    fast_name: 'THE 21 DAY REBUILD',
    model_line: 'Daniel mourned three weeks and did not stop.',
    rules: ['No soft drinks.', 'Lights out at 10.'],
    daily_schedule: [
      { time: '6:40 AM', action: 'Wake and pray' },
      { time: '7:10 AM', action: 'Genius Joe and scripture' },
    ],
    phases: [
      { name: 'Withdrawal', from: 1, to: 7, theme: 'Commitment', goal: 'Get through it.', milestone: 'Day 7.' },
    ],
    prayer_plan: [{ week: 1, theme: 'Commitment', morning: 'Psalm 5:3', night: 'Psalm 4:8' }],
    journal_prompts: { Withdrawal: 'What did you reach for?', bad: 12 },
    focus: { Withdrawal: ['Full routine.', 'Pray first.'], empty: [] },
    after: { keep: 'Keep the wake time.', return: 'Return to coffee slowly.' },
  },
  ...over,
});

describe('parseReveal', () => {
  it('returns null for a member with no fast', () => {
    expect(parseReveal(null)).toBeNull();
    expect(parseReveal({})).toBeNull();
    expect(parseReveal('nonsense')).toBeNull();
    expect(parseReveal([])).toBeNull();
  });

  it('reads a full row the builder wrote', () => {
    const r = parseReveal(row());
    expect(r).not.toBeNull();
    expect(r!.name).toBe('THE 21 DAY REBUILD');
    expect(r!.duration).toBe(21);
    expect(r!.range).toContain('21 days');
    expect(r!.modelLine).toContain('Daniel mourned');
    expect(r!.refs).toEqual(['Daniel 10:2-3', 'Daniel 1:12']);
    expect(r!.rules).toHaveLength(2);
    expect(r!.schedule).toHaveLength(2);
    expect(r!.phases[0]!.theme).toBe('Commitment');
    expect(r!.prayerPlan[0]!.night).toBe('Psalm 4:8');
    expect(r!.oz).toBe(128);
    expect(r!.productState).toBe('equipped');
  });

  it('spans the range from the start date to the last day, inclusive', () => {
    // Day 1 is 2 March, so a 21 day fast ends on 22 March, not 23.
    const r = parseReveal(row());
    expect(r!.range).toContain('Mar 2');
    expect(r!.range).toContain('Mar 22');
  });

  it('filters the schedule through the fast own exclusions', () => {
    const r = parseReveal(row({ exclusions: ['Genius Joe'] }));
    expect(r!.schedule).toHaveLength(1);
    expect(r!.schedule[0]!.action).toBe('Wake and pray');
  });

  it('falls back through the model title and then a plain name', () => {
    const noPlanName = row();
    delete (noPlanName.plan as Record<string, unknown>).fast_name;
    expect(parseReveal(noPlanName)!.name).toBe("DANIEL'S 21 DAYS");

    // A legacy row can carry `fast_model` as a bare string.
    expect(parseReveal(row({ plan: {}, fast_model: 'ESTHER 3 DAY' }))!.name).toBe('ESTHER 3 DAY');
    expect(parseReveal(row({ plan: {}, fast_model: null }))!.name).toBe('Your Fast');
  });

  it('renders an empty section rather than throwing on a malformed plan', () => {
    const r = parseReveal(row({ plan: { rules: 'not a list', phases: [{ nope: 1 }], prayer_plan: 'x' } }));
    expect(r!.rules).toEqual([]);
    expect(r!.phases).toEqual([]);
    expect(r!.prayerPlan).toEqual([]);
    expect(r!.schedule).toEqual([]);
    expect(r!.after).toEqual({ keep: '', return: '' });
  });

  it('drops non-string prompts and empty focus lists', () => {
    const r = parseReveal(row());
    expect(r!.journalPrompts).toEqual({ Withdrawal: 'What did you reach for?' });
    expect(Object.keys(r!.focus)).toEqual(['Withdrawal']);
  });

  it('defaults an unknown product state to unequipped so the equip card can show', () => {
    expect(parseReveal(row({ product_state: undefined }))!.productState).toBe('unequipped');
  });

  it('degrades the range when the row has no usable dates', () => {
    expect(parseReveal(row({ start_date: '', duration: 0 }))!.range).toBe('');
    expect(parseReveal(row({ duration: 0 }))!.range).not.toContain('days');
  });
});

describe('splitPlanName', () => {
  it('lifts the first number out so the reveal can colour it', () => {
    expect(splitPlanName('THE 21 DAY REBUILD')).toEqual({
      before: 'THE ',
      number: '21',
      after: ' DAY REBUILD',
    });
  });

  it('leaves a nameless number alone', () => {
    expect(splitPlanName('THE REBUILD')).toEqual({ before: 'THE REBUILD', number: '', after: '' });
    expect(splitPlanName('')).toEqual({ before: '', number: '', after: '' });
  });

  it('splits on the first run of digits only', () => {
    expect(splitPlanName('40 DAYS, 3 PHASES')).toEqual({
      before: '',
      number: '40',
      after: ' DAYS, 3 PHASES',
    });
  });
});
