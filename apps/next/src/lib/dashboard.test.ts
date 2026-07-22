import { describe, expect, it } from 'vitest';
import { bundleState, firstStepsProgress, selectDirective, FIRST_STEPS } from './dashboard';

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
