import { describe, expect, it } from 'vitest';
import { dayCompletion, formatAdherence, groupByWindow, toWindow, type RhythmSlot } from './rhythm';

function slot(partial: Partial<RhythmSlot> & { id: string }): RhythmSlot {
  return { title: 'Anchor', window: 'anytime', done: false, ...partial };
}

describe('toWindow', () => {
  it('passes through known windows', () => {
    for (const w of ['morning', 'midday', 'afternoon', 'evening'] as const) {
      expect(toWindow(w)).toBe(w);
    }
  });
  it('defaults unknown to anytime', () => {
    expect(toWindow('night')).toBe('anytime');
    expect(toWindow(undefined)).toBe('anytime');
  });
});

describe('groupByWindow', () => {
  it('orders windows and drops empty buckets', () => {
    const groups = groupByWindow([
      slot({ id: 'a', window: 'evening' }),
      slot({ id: 'b', window: 'morning' }),
      slot({ id: 'c', window: 'morning' }),
    ]);
    expect(groups.map((g) => g.window)).toEqual(['morning', 'evening']);
    expect(groups[0]!.slots).toHaveLength(2);
  });
});

describe('dayCompletion', () => {
  it('reports partial completion', () => {
    expect(dayCompletion([slot({ id: 'a', done: true }), slot({ id: 'b', done: false })])).toEqual({
      done: 1,
      total: 2,
      complete: false,
    });
  });
  it('is complete only when all done and non-empty', () => {
    expect(dayCompletion([slot({ id: 'a', done: true })])).toEqual({
      done: 1,
      total: 1,
      complete: true,
    });
    expect(dayCompletion([])).toEqual({ done: 0, total: 0, complete: false });
  });
});

describe('formatAdherence', () => {
  it('rounds and clamps', () => {
    expect(formatAdherence(87.4)).toBe('87%');
    expect(formatAdherence(120)).toBe('100%');
    expect(formatAdherence(-5)).toBe('0%');
  });
});
