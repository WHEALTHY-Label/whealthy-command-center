import { describe, expect, it } from 'vitest';
import {
  dayCompletion,
  formatAdherence,
  groupByWindow,
  parseRhythmStatus,
  toWindow,
  type RhythmSlot,
} from './rhythm';

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

/**
 * These fixtures are the deployed `rhythm-status` response shape, not an
 * invented one. Each assertion here stands in for a field the app previously
 * read under the wrong name.
 */
describe('parseRhythmStatus', () => {
  it('reads an active plan the way the function actually answers', () => {
    const status = parseRhythmStatus({
      ok: true,
      has_quiz: true,
      has_plan: true,
      active_plan: true,
      plan_id: 'plan-1',
      ics_token: 'tok',
      pending_draft_id: null,
      slots: [
        {
          id: 's1',
          domain: 'supplement',
          title: 'Genius Joe',
          product_key: 'genius_joe',
          cue_type: 'time',
          cue_value: '07:00',
          if_then_text: 'When I wake at 06:30, I take Genius Joe.',
          day_mask: 127,
          time_window: 'morning',
          duration_min: 10,
          sort_order: 1,
          why: 'Caffeine, before your cutoff.',
          origin: 'engine',
          today_status: 'done',
        },
        {
          id: 's2',
          domain: 'scripture',
          title: 'Open the Word',
          cue_type: 'stack',
          cue_value: 'after the morning cup',
          time_window: 'morning',
          sort_order: 0,
          origin: 'engine',
          today_status: null,
        },
      ],
      adherence: { d7: 82, d30: 71 },
      adherence_pct: 82,
      consistency_days: 9,
      season: { source: 'rhythm', day: 4, total: 21, can_commit: false },
      fresh_start: { show: false },
      unclaimed_products: [{ slot_id: 's1', product_key: 'genius_joe', title: 'Genius Joe' }],
    });

    expect(status.active).toBe(true);
    expect(status.isDraft).toBe(false);
    expect(status.planId).toBe('plan-1');
    expect(status.icsToken).toBe('tok');
    // adherence lives under `adherence.d7`, not `adherence_7`
    expect(status.adherence7).toBe(82);
    expect(status.adherence30).toBe(71);
    expect(status.consistencyDays).toBe(9);
    // `fresh_start` is always an object; only `show` means show it
    expect(status.freshStart).toBe(false);
    // slots come back in sort_order, not response order
    expect(status.slots.map((s) => s.id)).toEqual(['s2', 's1']);
    expect(status.slots.find((s) => s.id === 's1')?.done).toBe(true);
    // the unclaimed flag is derived from its own list, keyed by slot id
    expect(status.slots.find((s) => s.id === 's1')?.productUnclaimed).toBe(true);
    expect(status.slots.find((s) => s.id === 's2')?.productUnclaimed).toBe(false);
    expect(status.season.source).toBe('rhythm');
    expect(status.season.canCommit).toBe(false);
  });

  it('carries every field a running season sends, not just its source', () => {
    const status = parseRhythmStatus({
      has_plan: true,
      plan_id: 'p',
      slots: [],
      season: {
        source: 'rhythm',
        day: 4,
        total: 21,
        days_left: 17,
        start_date: '2026-07-19',
        completed: false,
        label: 'Your 21-day rhythm',
      },
    });

    expect(status.season).toEqual({
      source: 'rhythm',
      day: 4,
      total: 21,
      daysLeft: 17,
      startDate: '2026-07-19',
      completed: false,
      label: 'Your 21-day rhythm',
      // The function stops sending `can_commit` once a season is running, so the
      // parsed default is true and `source` is what decides the offer.
      canCommit: true,
      options: [21, 40, 90],
    });
  });

  it('keeps a fast on its own source and cohort', () => {
    const status = parseRhythmStatus({
      has_plan: true,
      plan_id: 'p',
      slots: [],
      season: {
        source: 'fast',
        day: 3,
        total: 3,
        days_left: 0,
        cohort_id: 'c-7',
        completed: false,
        label: 'Running with your Fast',
      },
    });

    expect(status.season.source).toBe('fast');
    expect(status.season.cohortId).toBe('c-7');
    expect(status.season.daysLeft).toBe(0);
  });

  it('reads an idle season as an offer with the lengths the function allows', () => {
    const status = parseRhythmStatus({
      has_plan: true,
      plan_id: 'p',
      slots: [],
      season: { source: null, can_commit: true, options: [21, 40, 90] },
    });

    expect(status.season.source).toBeNull();
    expect(status.season.canCommit).toBe(true);
    expect(status.season.options).toEqual([21, 40, 90]);
    expect(status.season.completed).toBe(false);
  });

  it('marks a season that ran past its last day complete', () => {
    const status = parseRhythmStatus({
      has_plan: true,
      plan_id: 'p',
      slots: [],
      season: { source: 'rhythm', day: 21, total: 21, days_left: 0, completed: true },
    });

    expect(status.season.completed).toBe(true);
  });

  it('shows the fresh-start moment only when the function raises it', () => {
    const status = parseRhythmStatus({
      has_plan: true,
      plan_id: 'p',
      slots: [],
      fresh_start: { show: true, last_week_adherence: 60, line: 'A new week, a clean page.' },
    });
    expect(status.freshStart).toBe(true);
  });

  it('treats a draft as not yet live and carries its suggestions', () => {
    const status = parseRhythmStatus({
      ok: true,
      has_quiz: true,
      has_plan: false,
      active_plan: false,
      is_draft: true,
      pending_draft: 'draft-9',
      pending_draft_id: 'draft-9',
      plan_id: 'draft-9',
      invite: 'Start with these two.',
      slots: [
        {
          id: 'd1',
          domain: 'prayer',
          title: 'Prayer check-in',
          cue_type: 'stack',
          cue_value: 'before bed',
          time_window: 'evening',
          sort_order: 0,
          today_status: null,
        },
      ],
      suggestions: [
        {
          domain: 'supplement',
          title: 'Hydration (recommended)',
          product_key: 'hydration',
          cue_type: 'time',
          cue_value: '14:00',
          time_window: 'afternoon',
          why: 'No caffeine, so it floats to the afternoon dip.',
          suggest_order: 0,
        },
      ],
    });

    expect(status.active).toBe(false);
    expect(status.isDraft).toBe(true);
    expect(status.pendingDraftId).toBe('draft-9');
    expect(status.planId).toBe('draft-9');
    expect(status.invite).toBe('Start with these two.');
    expect(status.slots).toHaveLength(1);
    expect(status.suggestions[0]?.key).toBe('hydration');
    expect(status.suggestions[0]?.window).toBe('afternoon');
  });

  it('degrades to the empty status on a shape it does not recognise', () => {
    expect(parseRhythmStatus(null).active).toBe(false);
    expect(parseRhythmStatus('nope').slots).toEqual([]);
    expect(parseRhythmStatus({ has_quiz: true }).hasQuiz).toBe(true);
    expect(parseRhythmStatus({ has_quiz: true }).slots).toEqual([]);
  });
});
