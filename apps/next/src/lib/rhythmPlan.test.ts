import { describe, expect, it } from 'vitest';
import type { RhythmSlot, RhythmSuggestion } from './rhythm';
import {
  canAddSlot,
  draftSummary,
  emptySlotForm,
  fullPlanLine,
  ifThenPreview,
  isSlotFormValid,
  MAX_ACTIVE_SLOTS,
  moveSlot,
  openSuggestions,
  slotToForm,
  toEditableWindow,
  toSlotDomain,
  windowOfCue,
} from './rhythmPlan';

function slot(partial: Partial<RhythmSlot> & { id: string }): RhythmSlot {
  return {
    title: 'Anchor',
    domain: 'custom',
    window: 'anytime',
    cueType: 'time',
    dayMask: 127,
    durationMin: 10,
    sortOrder: 0,
    done: false,
    ...partial,
  };
}

function suggestion(partial: Partial<RhythmSuggestion> & { key: string }): RhythmSuggestion {
  return {
    title: 'Suggested',
    domain: 'supplement',
    window: 'morning',
    cueType: 'time',
    dayMask: 127,
    durationMin: 10,
    ...partial,
  };
}

describe('windowOfCue', () => {
  it('matches the edge function boundaries', () => {
    expect(windowOfCue('00:00')).toBe('morning');
    expect(windowOfCue('10:59')).toBe('morning');
    expect(windowOfCue('11:00')).toBe('midday');
    expect(windowOfCue('13:59')).toBe('midday');
    expect(windowOfCue('14:00')).toBe('afternoon');
    expect(windowOfCue('17:59')).toBe('afternoon');
    expect(windowOfCue('18:00')).toBe('evening');
    expect(windowOfCue('23:30')).toBe('evening');
  });
  it('falls back to anytime for a stack cue', () => {
    expect(windowOfCue('after the morning cup')).toBe('anytime');
    expect(windowOfCue('')).toBe('anytime');
    expect(windowOfCue('99:00')).toBe('anytime');
  });
});

describe('toEditableWindow', () => {
  it('sends a window only when the cue is a clock time', () => {
    expect(toEditableWindow('06:30')).toBe('morning');
    expect(toEditableWindow('19:00')).toBe('evening');
    // Anything the server would place itself is left to the server.
    expect(toEditableWindow('after the morning cup')).toBeUndefined();
    expect(toEditableWindow('')).toBeUndefined();
  });
});

describe('isSlotFormValid', () => {
  it('requires a title', () => {
    expect(isSlotFormValid({ ...emptySlotForm(), cueValue: '06:00' })).toBe(false);
    expect(isSlotFormValid({ ...emptySlotForm(), title: '  ', cueValue: '06:00' })).toBe(false);
  });
  it('requires a clock cue when the cue is a time', () => {
    const base = { ...emptySlotForm(), title: 'Walk' };
    expect(isSlotFormValid({ ...base, cueValue: 'sometime' })).toBe(false);
    expect(isSlotFormValid({ ...base, cueValue: '06:30' })).toBe(true);
  });
  it('accepts any free text when the cue is a stack', () => {
    expect(
      isSlotFormValid({
        ...emptySlotForm(),
        title: 'Walk',
        cueType: 'stack',
        cueValue: 'after breakfast',
      }),
    ).toBe(true);
    expect(
      isSlotFormValid({ ...emptySlotForm(), title: 'Walk', cueType: 'stack', cueValue: '  ' }),
    ).toBe(false);
  });
});

describe('ifThenPreview', () => {
  it('builds the implementation intention the server would store', () => {
    expect(
      ifThenPreview({
        ...emptySlotForm(),
        title: 'Open the Word',
        cueType: 'stack',
        cueValue: 'after the morning cup',
      }),
    ).toBe('When after the morning cup, I open the word.');
  });
  it('drops the when clause with no cue, and is empty with no title', () => {
    expect(ifThenPreview({ ...emptySlotForm(), title: 'Walk' })).toBe('I walk.');
    expect(ifThenPreview(emptySlotForm())).toBe('');
  });
});

describe('the soft cap', () => {
  it('mirrors the edge function at fourteen', () => {
    expect(MAX_ACTIVE_SLOTS).toBe(14);
    expect(canAddSlot(13)).toBe(true);
    expect(canAddSlot(14)).toBe(false);
    expect(fullPlanLine(13)).toBeNull();
    expect(fullPlanLine(14)).toContain('full');
  });
});

describe('moveSlot', () => {
  it('swaps neighbours without mutating the input', () => {
    const source = ['a', 'b', 'c'];
    expect(moveSlot(source, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveSlot(source, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(source).toEqual(['a', 'b', 'c']);
  });
  it('is a no-op at the edges', () => {
    expect(moveSlot(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveSlot(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(moveSlot([], 0, 1)).toEqual([]);
  });
});

describe('openSuggestions', () => {
  it('hides anything already in the plan by product or title', () => {
    const slots = [
      slot({ id: '1', title: 'Genius Joe', productKey: 'genius_joe' }),
      slot({ id: '2', title: 'Date night' }),
    ];
    const open = openSuggestions(
      [
        suggestion({ key: 'genius_joe', title: 'Genius Joe (recommended)', productKey: 'genius_joe' }),
        suggestion({ key: 'family-Date night', title: 'Date night', domain: 'family' }),
        suggestion({ key: 'hydration', title: 'Hydration', productKey: 'hydration' }),
      ],
      slots,
    );
    expect(open.map((s) => s.key)).toEqual(['hydration']);
  });
});

describe('draftSummary', () => {
  it('counts anchors and never implies anything is scheduled', () => {
    expect(draftSummary([])).toBe('Nothing is in your rhythm yet.');
    expect(draftSummary([slot({ id: '1' })])).toBe('One anchor, waiting on you.');
    expect(draftSummary([slot({ id: '1' }), slot({ id: '2' })])).toBe('2 anchors, waiting on you.');
    for (const line of [draftSummary([]), draftSummary([slot({ id: '1' })])]) {
      expect(line).not.toMatch(/schedul|start|day \d/i);
    }
  });
});

describe('slotToForm and toSlotDomain', () => {
  it('round-trips an engine slot into the editor', () => {
    const form = slotToForm(
      slot({
        id: '1',
        title: 'Open the Word',
        domain: 'scripture',
        cueType: 'stack',
        cue: 'after the morning cup',
        why: 'Stacked on a routine you already keep.',
      }),
    );
    expect(form).toEqual({
      title: 'Open the Word',
      domain: 'scripture',
      cueType: 'stack',
      cueValue: 'after the morning cup',
      why: 'Stacked on a routine you already keep.',
    });
  });
  it('falls back to custom for a domain the app does not know', () => {
    expect(toSlotDomain('scripture')).toBe('scripture');
    expect(toSlotDomain('sabbath')).toBe('custom');
    expect(toSlotDomain(undefined)).toBe('custom');
  });
});
