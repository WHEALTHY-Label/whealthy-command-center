import { describe, expect, it } from 'vitest';
import {
  answersPayload,
  canAdvance,
  derivedProfile,
  isComplete,
  PATTERN_NAMES,
  PATTERN_REVEAL,
  PEAK_BLOCKS,
  PROGRESS_WIDTHS,
  QUIZ_QUESTIONS,
  runQuizScoring,
  screenChrome,
  type Pattern,
  type QuizAnswers,
} from './quiz';

/**
 * A complete answer set that opens no gate, so each test can open exactly the
 * one it is about. shape 0 with no peak is not a legal combination for
 * `isComplete`, so the base uses shape 2 (no peak) and gate three stays shut.
 */
function base(over: Partial<QuizAnswers> = {}): QuizAnswers {
  return {
    shape: 2,
    resource: 1, // does not fire
    timescale: 0, // does not fire
    input: 0, // does not fire
    source: 1, // not the cup
    history: 0,
    leaning: 0,
    season: 0,
    matters: 0,
    govern: [0],
    looking: 0,
    ...over,
  };
}

/** The option label for a screen, read from the question table itself. */
function label(screen: number, index: number): string {
  const q = QUIZ_QUESTIONS[screen];
  const list = q?.opts;
  return list?.[index] ?? '';
}

describe('QUIZ_QUESTIONS', () => {
  it('is eleven screens with the shapes the flow renders', () => {
    expect(QUIZ_QUESTIONS).toHaveLength(11);
    expect(QUIZ_QUESTIONS.map((q) => q.kind)).toEqual([
      'single',
      'single',
      'double',
      'single',
      'single',
      'single',
      'single',
      'single',
      'multi',
      'single',
      'text',
    ]);
  });

  it('gives every choice screen its options, and the double screen both halves', () => {
    QUIZ_QUESTIONS.forEach((q, i) => {
      if (q.kind === 'text') {
        expect(q.opts, `screen ${i}`).toBeUndefined();
        return;
      }
      expect(q.opts?.length, `screen ${i}`).toBeGreaterThan(1);
      if (q.kind === 'double') {
        expect(q.q2, `screen ${i}`).toBeTruthy();
        expect(q.opts2?.length, `screen ${i}`).toBeGreaterThan(1);
      }
    });
  });
});

describe('screenChrome', () => {
  it('counts ten questions and marks the eleventh optional', () => {
    expect(screenChrome(0).counter).toBe('Question 1 of 10');
    expect(screenChrome(9).counter).toBe('Question 10 of 10');
    expect(screenChrome(10).counter).toBe('Optional Step');
  });

  it('only offers the reveal on the last screen', () => {
    expect(screenChrome(9).button).toBe('Continue');
    expect(screenChrome(10).button).toBe('See My Pattern');
  });

  it('agrees with the chapter each question declares', () => {
    QUIZ_QUESTIONS.forEach((q, i) => {
      expect(screenChrome(i).chapter, `screen ${i}`).toBe(q.chapter);
    });
  });

  it('advances the progress bar and never exceeds full', () => {
    expect(PROGRESS_WIDTHS).toHaveLength(QUIZ_QUESTIONS.length);
    expect(screenChrome(0).progress).toBe(10);
    expect(screenChrome(9).progress).toBe(100);
    expect(screenChrome(10).progress).toBe(100);
    // Out of range must not produce an undefined width.
    expect(screenChrome(99).progress).toBe(100);
  });
});

describe('runQuizScoring gate one, the floor', () => {
  it('opens on a diminished shape plus two corroborating signals', () => {
    const got = runQuizScoring(base({ shape: 1, resource: 0, timescale: 1, input: 0 }));
    expect(got.pattern).toBe('low-floor');
    expect(got.bundleKey).toBe('charge');
    expect(got.signals.floorCount).toBe(2);
  });

  it('opens for shape 2 as well as shape 1', () => {
    expect(runQuizScoring(base({ shape: 2, resource: 0, input: 2 })).pattern).toBe('low-floor');
  });

  it('stays shut on one signal, however severe', () => {
    const got = runQuizScoring(base({ shape: 1, resource: 0, timescale: 0, input: 0 }));
    expect(got.signals.floorCount).toBe(1);
    expect(got.pattern).not.toBe('low-floor');
  });

  it('stays shut when the shape still fires, whatever the signals say', () => {
    // shape 0 means the peak is intact, so the floor is not the story.
    const got = runQuizScoring(
      base({ shape: 0, peakBlock: 'midday', resource: 0, timescale: 1, input: 1 }),
    );
    expect(got.signals.floorCount).toBe(3);
    expect(got.pattern).toBe('energy-without-aim');
  });

  it('treats "I cannot remember" as an unknown, not as severity', () => {
    // input 3 is the missing-memory answer. It must fire nothing.
    const got = runQuizScoring(base({ shape: 1, resource: 0, timescale: 0, input: 3 }));
    expect(got.signals.input_fires).toBe(false);
    expect(got.signals.floorCount).toBe(1);
    expect(got.pattern).not.toBe('low-floor');
  });

  it('counts each of the three signals independently', () => {
    const s = runQuizScoring(base({ shape: 1, resource: 0, timescale: 2, input: 1 })).signals;
    expect(s).toMatchObject({
      shape_fires: true,
      resource_fires: true,
      timescale_fires: true,
      input_fires: true,
      floorCount: 3,
    });
    const none = runQuizScoring(base({ shape: 0, peakBlock: 'evening' })).signals;
    expect(none).toMatchObject({
      shape_fires: false,
      resource_fires: false,
      timescale_fires: false,
      input_fires: false,
      floorCount: 0,
    });
  });
});

describe('runQuizScoring gate two, the source', () => {
  it('opens when the day does not start without the cup', () => {
    const got = runQuizScoring(base({ source: 0 }));
    expect(got.pattern).toBe('morning-dependency');
    expect(got.bundleKey).toBe('genius-joe');
    expect(got.signals.source_fires).toBe(true);
  });

  it('loses to gate one, which is checked first', () => {
    const got = runQuizScoring(base({ shape: 1, resource: 0, timescale: 1, source: 0 }));
    expect(got.pattern).toBe('low-floor');
  });

  it('beats a named peak', () => {
    expect(runQuizScoring(base({ shape: 0, peakBlock: 'midday', source: 0 })).pattern).toBe(
      'morning-dependency',
    );
  });
});

describe('runQuizScoring gate three, the spend', () => {
  it('routes a morning peak to the boss bundle', () => {
    for (const peak of ['early-morning', 'late-morning']) {
      const got = runQuizScoring(base({ shape: 0, peakBlock: peak }));
      expect(got.pattern, peak).toBe('energy-without-aim');
      expect(got.bundleKey, peak).toBe('boss');
    }
  });

  it('routes any later peak to genius guice', () => {
    for (const peak of ['midday', 'afternoon', 'evening']) {
      const got = runQuizScoring(base({ shape: 0, peakBlock: peak }));
      expect(got.pattern, peak).toBe('energy-without-aim');
      expect(got.bundleKey, peak).toBe('genius-guice');
    }
  });

  it('accepts every peak the flow offers', () => {
    for (const block of PEAK_BLOCKS) {
      expect(runQuizScoring(base({ shape: 0, peakBlock: block.value })).peakBlock).toBe(block.value);
    }
  });
});

describe('runQuizScoring fall-through', () => {
  it('lands on holding it together when no gate opens', () => {
    const got = runQuizScoring(base());
    expect(got.pattern).toBe('holding-it-together');
    expect(got.bundleKey).toBe('boss');
    expect(got.peakBlock).toBeNull();
  });

  it('names the pattern the same way the reveal does', () => {
    const patterns: Pattern[] = [
      'low-floor',
      'morning-dependency',
      'energy-without-aim',
      'holding-it-together',
    ];
    for (const p of patterns) {
      expect(PATTERN_NAMES[p], p).toBeTruthy();
      expect(PATTERN_REVEAL[p].halves.filter(Boolean), p).toHaveLength(2);
      expect(PATTERN_REVEAL[p].sig, p).toBeTruthy();
    }
    expect(runQuizScoring(base()).patternName).toBe(PATTERN_NAMES['holding-it-together']);
  });
});

describe('runQuizScoring load', () => {
  it('reads the season label, collapsing stacked and underwater', () => {
    expect(runQuizScoring(base({ season: 0 })).loadSeason).toBe('building');
    expect(runQuizScoring(base({ season: 1 })).loadSeason).toBe('carrying');
    expect(runQuizScoring(base({ season: 2 })).loadSeason).toBe('stacked');
    expect(runQuizScoring(base({ season: 3 })).loadSeason).toBe('stacked');
  });

  it('adds the leaning and season weights', () => {
    // leaning weights [1,2,3,3,4], season weights [1,2,3,4].
    expect(runQuizScoring(base({ leaning: 0, season: 0 })).loadScore).toBe(2);
    expect(runQuizScoring(base({ leaning: 4, season: 3 })).loadScore).toBe(8);
    expect(runQuizScoring(base({ leaning: 2, season: 1 })).loadScore).toBe(5);
    // Both index 2 and 3 of the leaning table weigh 3.
    expect(runQuizScoring(base({ leaning: 3, season: 1 })).loadScore).toBe(5);
  });

  it('falls back to a weight of one, not zero, on an unanswered or stray index', () => {
    const blank: QuizAnswers = {};
    expect(runQuizScoring(blank).loadScore).toBe(2);
    expect(runQuizScoring(base({ leaning: 99, season: 99 })).loadScore).toBe(2);
    expect(runQuizScoring(base({ leaning: undefined, season: 3 })).loadScore).toBe(5);
  });

  it('never scores outside the one to eight the reveal prints', () => {
    for (let leaning = 0; leaning < 5; leaning++) {
      for (let season = 0; season < 4; season++) {
        const n = runQuizScoring(base({ leaning, season })).loadScore;
        expect(n, `${leaning}/${season}`).toBeGreaterThanOrEqual(2);
        expect(n, `${leaning}/${season}`).toBeLessThanOrEqual(8);
      }
    }
  });
});

describe('runQuizScoring pathway', () => {
  it('lets the last question settle it outright, either way', () => {
    // looking 1 is the steward answer, and it wins with no other signal.
    expect(runQuizScoring(base({ looking: 1, matters: 0, govern: [0] })).pathway).toBe('steward');
    // looking 0 is the customer answer, and it wins despite every other signal.
    expect(runQuizScoring(base({ looking: 0, matters: 3, govern: [2, 3, 4] })).pathway).toBe(
      'customer',
    );
  });

  it('falls back to the steward signal when the last question is unanswered', () => {
    expect(runQuizScoring(base({ looking: undefined, matters: 1 })).pathway).toBe('steward');
    expect(runQuizScoring(base({ looking: undefined, matters: 2 })).pathway).toBe('steward');
    expect(runQuizScoring(base({ looking: undefined, matters: 3 })).pathway).toBe('steward');
    // matters 0 is work, which on its own is not a steward signal.
    expect(runQuizScoring(base({ looking: undefined, matters: 0, govern: [0, 1] })).pathway).toBe(
      'customer',
    );
  });

  it('reads faith, family or provision in the govern picks as a steward signal', () => {
    for (const pick of [2, 3, 4]) {
      expect(
        runQuizScoring(base({ looking: undefined, matters: 0, govern: [pick] })).pathway,
        `govern ${pick}`,
      ).toBe('steward');
    }
    for (const pick of [0, 1]) {
      expect(
        runQuizScoring(base({ looking: undefined, matters: 0, govern: [pick] })).pathway,
        `govern ${pick}`,
      ).toBe('customer');
    }
  });
});

describe('runQuizScoring identity profile', () => {
  it('lets who is leaning on him win before the season is consulted', () => {
    expect(runQuizScoring(base({ leaning: 3, season: 3 })).identityProfile).toBe('operator');
    expect(runQuizScoring(base({ leaning: 2, season: 0 })).identityProfile).toBe('anchor');
    expect(runQuizScoring(base({ leaning: 4, season: 3 })).identityProfile).toBe('provider');
  });

  it('falls to the season, then to the quiet carrier', () => {
    expect(runQuizScoring(base({ leaning: 0, season: 3 })).identityProfile).toBe('long-haul');
    expect(runQuizScoring(base({ leaning: 1, season: 0 })).identityProfile).toBe('builder');
    expect(runQuizScoring(base({ leaning: 0, season: 1 })).identityProfile).toBe('quiet-carrier');
    expect(runQuizScoring(base({ leaning: 1, season: 2 })).identityProfile).toBe('quiet-carrier');
  });
});

describe('runQuizScoring skeptical flag', () => {
  it('is set only by "nothing happened"', () => {
    expect(runQuizScoring(base({ history: 2 })).skepticalFlag).toBe(true);
    // "Worked for a week or two, then stopped" is index 3 and must not set it.
    expect(runQuizScoring(base({ history: 3 })).skepticalFlag).toBe(false);
    expect(runQuizScoring(base({ history: 0 })).skepticalFlag).toBe(false);
    expect(runQuizScoring(base({ history: 1 })).skepticalFlag).toBe(false);
    expect(runQuizScoring(base({ history: undefined })).skepticalFlag).toBe(false);
  });
});

describe('derivedProfile', () => {
  it('infers the relationship and kids from who is leaning on him', () => {
    expect(derivedProfile({ leaning: 0 })).toMatchObject({ relationship: 'single', kids_count: 0 });
    expect(derivedProfile({ leaning: 1 })).toMatchObject({ relationship: 'married', kids_count: 0 });
    expect(derivedProfile({ leaning: 2 })).toMatchObject({ relationship: 'married', kids_count: 2 });
    expect(derivedProfile({ leaning: 3 })).toMatchObject({ relationship: 'single', kids_count: 0 });
    expect(derivedProfile({ leaning: 4 })).toMatchObject({ relationship: 'married', kids_count: 2 });
  });

  it('reads a crew at work as leadership', () => {
    expect(derivedProfile({ leaning: 3 }).job_type).toBe('leadership');
    expect(derivedProfile({ leaning: 2 }).job_type).toBe('desk');
    expect(derivedProfile({}).job_type).toBe('desk');
  });

  it('lifts the hours band for a stacked or underwater season', () => {
    expect(derivedProfile({ season: 2 }).hours_band).toBe('50-60');
    expect(derivedProfile({ season: 3 }).hours_band).toBe('50-60');
    expect(derivedProfile({ season: 1 }).hours_band).toBe('40-50');
    expect(derivedProfile({}).hours_band).toBe('40-50');
  });

  it('reads consumption from the cup', () => {
    expect(derivedProfile({ source: 0 }).consumption).toBe('coffee-heavy');
    expect(derivedProfile({ source: 1 }).consumption).toBe('coffee-light');
    expect(derivedProfile({ source: 2 }).consumption).toBe('willpower');
    expect(derivedProfile({}).consumption).toBe('willpower');
  });

  it('ships every field the CRM sync reads', () => {
    expect(Object.keys(derivedProfile({})).sort()).toEqual([
      'age_band',
      'consumption',
      'hours_band',
      'job_type',
      'kids_count',
      'relationship',
      'sex',
    ]);
  });
});

describe('answersPayload', () => {
  const full = base({
    shape: 0,
    peakBlock: 'midday',
    timescale: 1,
    input: 2,
    govern: [0, 2],
    carrying: 'A lot.',
  });

  it('sends option labels, not indices', () => {
    const p = answersPayload(full);
    expect(p.q1_shape).toBe(label(0, 0));
    expect(p.q1_shape).toBe('Yes, and I know when it hits');
    expect(p.q9_matters).toBe(label(7, 0));
    // Nothing in the block may be a bare number.
    for (const [k, v] of Object.entries(p)) {
      expect(typeof v, k).toBe('string');
    }
  });

  it('reads both halves of the double screen from their own lists', () => {
    const p = answersPayload(full);
    expect(p.q3_timescale).toBe(QUIZ_QUESTIONS[2]?.opts?.[1]);
    expect(p.q4_input).toBe(QUIZ_QUESTIONS[2]?.opts2?.[2]);
    expect(p.q4_input).toBe("It didn't move much");
  });

  // The key names carry a known off-by-one against the screen indices. It is
  // reproduced deliberately so old rows and downstream reporting keep matching.
  it('keeps the live key names, off-by-one and all', () => {
    const p = answersPayload(full);
    expect(Object.keys(p)).toEqual([
      'q1_shape',
      'q1_peak_block',
      'q2_resource',
      'q3_timescale',
      'q4_input',
      'q5_source',
      'q6_history',
      'q7_leaning',
      'q8_season',
      'q9_matters',
      'q10_govern',
      'q11_looking',
      'q12_carrying',
    ]);
    // q5_source is screen 3, not screen 5.
    expect(p.q5_source).toBe(label(3, 1));
  });

  it('comma joins the multi pick in the order given', () => {
    expect(answersPayload(full).q10_govern).toBe(`${label(8, 0)},${label(8, 2)}`);
    expect(answersPayload(base({ govern: [] })).q10_govern).toBe('');
    expect(answersPayload({}).q10_govern).toBe('');
  });

  it('empties an unanswered screen rather than inventing a label', () => {
    const p = answersPayload({});
    expect(p.q1_shape).toBe('');
    expect(p.q1_peak_block).toBe('');
    expect(p.q12_carrying).toBe('');
    // A stray index must not blow up or leak undefined.
    expect(answersPayload(base({ matters: 99 })).q9_matters).toBe('');
  });

  it('carries the optional reflection through untouched', () => {
    expect(answersPayload(full).q12_carrying).toBe('A lot.');
  });
});

describe('isComplete', () => {
  it('accepts a fully answered set', () => {
    expect(isComplete(base())).toBe(true);
    expect(isComplete(base({ shape: 0, peakBlock: 'evening' }))).toBe(true);
  });

  it('does not require the optional reflection', () => {
    const { carrying, ...rest } = base({ carrying: 'x' });
    expect(carrying).toBe('x');
    expect(isComplete(rest)).toBe(true);
  });

  it('requires a peak once the member says the peak is there', () => {
    expect(isComplete(base({ shape: 0, peakBlock: undefined }))).toBe(false);
    expect(isComplete(base({ shape: 0, peakBlock: '' }))).toBe(false);
  });

  it('requires at least one govern pick', () => {
    expect(isComplete(base({ govern: [] }))).toBe(false);
    expect(isComplete(base({ govern: undefined }))).toBe(false);
  });

  it('rejects a set with any counted screen missing', () => {
    const keys: (keyof QuizAnswers)[] = [
      'shape',
      'resource',
      'timescale',
      'input',
      'source',
      'history',
      'leaning',
      'season',
      'matters',
      'looking',
    ];
    for (const key of keys) {
      const partial = base();
      delete partial[key];
      expect(isComplete(partial), `missing ${key}`).toBe(false);
    }
  });

  it('rejects an empty set', () => {
    expect(isComplete({})).toBe(false);
  });
});

describe('canAdvance', () => {
  it('holds the first screen until a peak is named, when one was claimed', () => {
    expect(canAdvance(0, {})).toBe(false);
    expect(canAdvance(0, { shape: 0 })).toBe(false);
    expect(canAdvance(0, { shape: 0, peakBlock: 'midday' })).toBe(true);
    expect(canAdvance(0, { shape: 1 })).toBe(true);
    expect(canAdvance(0, { shape: 2 })).toBe(true);
  });

  it('holds the double screen until both halves are answered', () => {
    expect(canAdvance(2, { timescale: 0 })).toBe(false);
    expect(canAdvance(2, { input: 0 })).toBe(false);
    expect(canAdvance(2, { timescale: 0, input: 0 })).toBe(true);
  });

  it('holds the multi screen until something is picked', () => {
    expect(canAdvance(8, { govern: [] })).toBe(false);
    expect(canAdvance(8, { govern: [1] })).toBe(true);
  });

  it('never blocks the optional reflection', () => {
    expect(canAdvance(10, {})).toBe(true);
  });

  it('blocks a screen index the flow does not have', () => {
    expect(canAdvance(11, base())).toBe(false);
    expect(canAdvance(-1, base())).toBe(false);
  });

  it('lets a complete set through every screen', () => {
    const a = base({ shape: 0, peakBlock: 'midday' });
    for (let step = 0; step < QUIZ_QUESTIONS.length; step++) {
      expect(canAdvance(step, a), `step ${step}`).toBe(true);
    }
  });

  it('agrees with isComplete on the last counted screen', () => {
    // Passing every screen is the same claim as a complete set.
    const a = base();
    const everyScreen = QUIZ_QUESTIONS.every((_q, step) => canAdvance(step, a));
    expect(everyScreen).toBe(isComplete(a));
  });
});
