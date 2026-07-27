import { describe, expect, it } from 'vitest';
import {
  altLine,
  buildFallbackPlan,
  bundleLine,
  composeFastRow,
  computeExclusions,
  DEFAULT_ANCHORS,
  defaultTakes,
  endDayKey,
  FASTS,
  filterSchedule,
  findPattern,
  fmtTime,
  guardFreeText,
  historyLine,
  initialWizardState,
  LIB,
  matchFast,
  memberLine,
  phaseRanges,
  readinessRead,
  recommendAnchors,
  recordLine,
  repairPrayerPlan,
  rulePhrases,
  scriptureWhitelist,
  unfinishedLine,
  validRef,
  type FastHistoryRow,
  type FastPattern,
  type PrayerWeek,
} from './fastbuild';

const pattern = (id: string): FastPattern => {
  const f = findPattern(id);
  if (!f) throw new Error(`no pattern ${id}`);
  return f;
};

const history = (over: Partial<FastHistoryRow>): FastHistoryRow => ({
  model: 'DANIEL’S 21 DAYS',
  duration: 21,
  ended_day: null,
  finished: true,
  weak_rule: null,
  ...over,
});

describe('matchFast', () => {
  it('puts the primary why ahead of a secondary one', () => {
    // Esther and David both carry intercession first, so both score 3 and the
    // library order decides; neither is an exact fit on a single why.
    const m = matchFast(['intercession'], null, null);
    expect(m.primary.id).toBe('esther');
    expect(m.alt?.id).toBe('david');
  });

  it('rewards an exact fit across every why the pattern carries', () => {
    const m = matchFast(['intercession', 'direction'], null, null);
    expect(m.primary.id).toBe('esther'); // 3 + 1.5 + 1
    expect(m.primary.days).toBe(3);
  });

  it('penalises forty days for someone who has never fasted', () => {
    // Wilderness is the only preparation pattern and would win outright, but
    // -3 for 40 days plus +0.75 toward short fasts flips it to Nehemiah.
    expect(matchFast(['preparation'], 'few', null).primary.id).toBe('wilderness');
    const never = matchFast(['preparation'], 'never', null);
    expect(never.primary.id).toBe('nehemiah');
    expect(never.alt?.id).toBe('wilderness');
  });

  it('steps back from long patterns when the last fast was left unfinished', () => {
    const whys = ['repentance', 'freedom'];
    expect(matchFast(whys, 'few', null).primary.id).toBe('daniel-discipline');
    // Reached day 5 and stopped, so anything 10 days or longer loses a point
    // and the three day turning takes the lead.
    const after = matchFast(whys, 'few', history({ finished: false, ended_day: 5 }));
    expect(after.primary.id).toBe('nineveh');
  });

  it('ignores a finished fast and a fast that ended on day one', () => {
    const whys = ['repentance', 'freedom'];
    expect(matchFast(whys, 'few', history({ finished: true, ended_day: 5 })).primary.id).toBe(
      'daniel-discipline',
    );
    expect(matchFast(whys, 'few', history({ finished: false, ended_day: 1 })).primary.id).toBe(
      'daniel-discipline',
    );
    expect(matchFast(whys, 'few', history({ finished: false, ended_day: null })).primary.id).toBe(
      'daniel-discipline',
    );
  });

  it('falls back to the 21 days when nothing scores', () => {
    const m = matchFast([], null, null);
    expect(m.primary.id).toBe('daniel-mourning');
    expect(m.alt).toBeNull();
  });
});

describe('phaseRanges', () => {
  it('holds the boundaries the plan is written against', () => {
    expect(phaseRanges(3)).toEqual([{ name: 'Set Apart', from: 1, to: 3, theme: 'Commitment' }]);

    const seven = phaseRanges(7);
    expect(seven).toHaveLength(2);
    expect(seven[0]).toMatchObject({ from: 1, to: 5 });
    expect(seven[1]).toMatchObject({ from: 6, to: 7, theme: 'Victory' });

    const ten = phaseRanges(10);
    expect(ten).toHaveLength(3);
    expect(ten[2]).toMatchObject({ name: 'Finish Strong', from: 9, to: 10 });

    const twentyOne = phaseRanges(21);
    expect(twentyOne).toHaveLength(3);
    expect(twentyOne[1]).toMatchObject({ name: 'Discipline', from: 8, to: 14 });
    expect(twentyOne[2]).toMatchObject({ name: 'Breakthrough', from: 15, to: 21 });

    const forty = phaseRanges(40);
    expect(forty).toHaveLength(4);
    expect(forty[3]).toMatchObject({ name: 'Finish Strong', from: 31, to: 40 });
  });

  it('never leaves a gap or an inverted range', () => {
    for (const n of [3, 4, 5, 6, 7, 8, 10, 14, 21, 30, 40]) {
      const phases = phaseRanges(n);
      expect(phases[0]!.from).toBe(1);
      expect(phases[phases.length - 1]!.to).toBe(n);
      phases.forEach((p, i) => {
        expect(p.to).toBeGreaterThanOrEqual(p.from);
        if (i > 0) expect(p.from).toBe(phases[i - 1]!.to + 1);
      });
    }
  });
});

describe('fmtTime', () => {
  it('reads a 24 hour anchor as the live app renders it', () => {
    expect(fmtTime('06:40')).toBe('6:40am');
    expect(fmtTime('22:00')).toBe('10:00pm');
    expect(fmtTime('22:45')).toBe('10:45pm');
    expect(fmtTime('00:15')).toBe('12:15am');
    expect(fmtTime('12:00')).toBe('12:00pm');
    expect(fmtTime('nope')).toBe('nope');
  });
});

describe('endDayKey', () => {
  it('counts the start day as day one', () => {
    expect(endDayKey('2026-07-22', 21)).toBe('2026-08-11');
    expect(endDayKey('2026-07-22', 1)).toBe('2026-07-22');
    expect(endDayKey('2026-12-30', 3)).toBe('2027-01-01');
    expect(endDayKey('nope', 3)).toBe('nope');
  });
});

describe('guardFreeText', () => {
  it('rejects body language before it allows a food fast', () => {
    expect(guardFreeText('losing weight')).toBe('weight');
    expect(guardFreeText('water only diet')).toBe('weight');
    expect(guardFreeText('water only')).toBe('food');
    expect(guardFreeText('no food after sundown')).toBe('food');
    expect(guardFreeText('Late night scrolling')).toBeNull();
  });
});

describe('computeExclusions', () => {
  it('rules out only what the caffeine scope covers', () => {
    expect(computeExclusions(['Coffee'], 'coffee')).toEqual(['Genius Joe']);
    expect(computeExclusions(['Coffee'], 'all')).toEqual(['Genius Joe', 'Charge']);
    expect(computeExclusions(['Energy drinks'], null)).toEqual(['Charge']);
    expect(computeExclusions(['Sugar'], null)).toEqual([]);
    expect(computeExclusions(['Coffee', 'Energy drinks'], 'coffee')).toEqual([
      'Genius Joe',
      'Charge',
    ]);
  });
});

describe('scripture references', () => {
  it('accepts only references the library actually carries', () => {
    expect(validRef('Matthew 6:16-18')).toBe(true);
    expect(validRef('Daniel 1:8-16')).toBe(true); // a pattern reference
    expect(validRef('Philippians 4:8')).toBe(false);
    expect(validRef(42)).toBe(false);
    expect(validRef(null)).toBe(false);
  });

  it('hands governor-ai a whitelist that opens and closes the fast', () => {
    const list = scriptureWhitelist();
    expect(list[0]).toBe(LIB.constants.open);
    expect(list).toContain('2 Timothy 4:7');
    expect(list).toContain('Romans 12:1-2');
    // Pattern references are valid but are not offered for the prayer plan.
    expect(list).not.toContain('Daniel 1:8-16');
    expect(list.every((r) => validRef(r))).toBe(true);
  });
});

describe('recommendAnchors', () => {
  it('moves lights out later when the record says so', () => {
    expect(recommendAnchors(false, null, false).anchors.lights).toBe('22:00');
    expect(recommendAnchors(true, null, false).anchors.lights).toBe('22:30');
  });

  it('gives back the fifteen minutes a broken fast took', () => {
    const r = recommendAnchors(true, history({ weak_rule: 'Lights out by 10:30pm' }), false);
    expect(r.anchors.lights).toBe('22:45');
    expect(r.reasons.lights).toContain('earns its way down');
  });

  it('names the routine in the hydration reason only when equipped', () => {
    expect(recommendAnchors(false, null, true).reasons.oz).toContain('Hydration routine');
    expect(recommendAnchors(false, null, false).reasons.oz).toContain('A gallon');
  });
});

describe('defaultTakes', () => {
  it('lists only the anchors that are switched on', () => {
    expect(defaultTakes(DEFAULT_ANCHORS)).toEqual([
      'Morning movement',
      'Daily walk (2 laps)',
      'Daily journal (5 minutes)',
      'Morning & Night Prayer',
    ]);
    expect(defaultTakes({ ...DEFAULT_ANCHORS, movement: false, laps: 0 })).toEqual([
      'Daily journal (5 minutes)',
      'Morning & Night Prayer',
    ]);
  });
});

describe('rulePhrases', () => {
  it('changes the coffee rule with the caffeine scope', () => {
    expect(rulePhrases(21, 'all').Coffee).toContain('No caffeine in any form');
    expect(rulePhrases(21, 'coffee').Coffee).toContain('stays in the cabinet');
  });

  it('writes the duration into the rules that carry it', () => {
    expect(rulePhrases(21, null)['The snooze button']).toContain('21 days');
    expect(rulePhrases(7, null).Alcohol).toContain('all 7 days');
  });
});

describe('buildFallbackPlan', () => {
  const inputs = {
    pattern: pattern('daniel-mourning'),
    duration: 21,
    laid: ['Coffee', 'Social media'],
    whys: ['direction', 'nearness'],
    caffScope: 'coffee' as const,
    anchors: { ...DEFAULT_ANCHORS },
    takingOn: ['Read to my son'],
    exclusions: computeExclusions(['Coffee'], 'coffee'),
    equipped: false,
  };

  it('produces a complete plan with no AI at all', () => {
    const plan = buildFallbackPlan(inputs);
    expect(plan.fast_name).toBe("DANIEL'S 21 DAYS");
    expect(plan.model_line).toBe(inputs.pattern.line);
    expect(plan.phases).toHaveLength(3);
    expect(plan.prayer_plan).toHaveLength(3);
    expect(Object.keys(plan.journal_prompts)).toEqual([
      'Foundation',
      'Discipline',
      'Breakthrough',
    ]);
    expect(plan.taking_on).toEqual(['Read to my son']);
  });

  it('caps the rules at nine and keeps the laid-down ones first', () => {
    const plan = buildFallbackPlan({
      ...inputs,
      laid: [
        'Coffee',
        'Social media',
        'Sugar',
        'Alcohol',
        'Gaming',
        'News',
        'Snacking',
        'Complaining',
        'Impulse spending',
        'Streaming',
      ],
    });
    expect(plan.rules).toHaveLength(9);
    expect(plan.rules[0]).toContain('coffee');
  });

  it('writes a rule for a laid-down item the library does not know', () => {
    const plan = buildFallbackPlan({ ...inputs, laid: ['Late night podcasts'] });
    expect(plan.rules[0]).toBe('Laid down: late night podcasts. Held for all 21 days.');
  });

  it('opens on the fasting passage and closes on a completion passage', () => {
    const plan = buildFallbackPlan(inputs);
    expect(plan.prayer_plan[0]!.morning).toBe(LIB.constants.open);
    expect(plan.prayer_plan[2]!.night).toBe(LIB.constants.close[0]);
    expect(plan.prayer_plan.every((w) => validRef(w.morning) && validRef(w.night))).toBe(true);
  });

  it('never closes a one week fast on a completion passage', () => {
    const plan = buildFallbackPlan({ ...inputs, duration: 7, pattern: pattern('david') });
    expect(plan.prayer_plan).toHaveLength(1);
    expect(LIB.constants.close).not.toContain(plan.prayer_plan[0]!.night);
  });

  it('runs the schedule from wake to lights out', () => {
    const plan = buildFallbackPlan(inputs);
    const first = plan.daily_schedule[0]!;
    const last = plan.daily_schedule[plan.daily_schedule.length - 1]!;
    expect(first.time).toBe('6:40am');
    expect(last).toEqual({ time: '10:00pm', action: 'Lights out.' });
    expect(plan.daily_schedule.length).toBeGreaterThanOrEqual(8);
  });

  it('drops the morning rows the member did not commit to', () => {
    const plan = buildFallbackPlan({
      ...inputs,
      anchors: { ...DEFAULT_ANCHORS, movement: false, laps: 0 },
    });
    const actions = plan.daily_schedule.map((s) => s.action).join(' | ');
    expect(actions).not.toContain('Morning movement');
    expect(actions).not.toContain('laps');
  });

  it('adds the afternoon routine row only for an equipped member', () => {
    const bare = buildFallbackPlan(inputs)
      .daily_schedule.map((s) => s.action)
      .join(' | ');
    expect(bare).not.toContain('afternoon routine');
    const equipped = buildFallbackPlan({ ...inputs, equipped: true })
      .daily_schedule.map((s) => s.action)
      .join(' | ');
    expect(equipped).toContain('afternoon routine');
  });

  it('only mentions picking things back up when something was excluded', () => {
    expect(buildFallbackPlan(inputs).after.return).toContain('after the final day');
    expect(buildFallbackPlan({ ...inputs, laid: ['Sugar'], exclusions: [] }).after.return).toBe('');
  });
});

describe('repairPrayerPlan', () => {
  const phases = phaseRanges(21);

  it('fixes week one morning to the fasting passage', () => {
    const rows: PrayerWeek[] = [
      { week: 1, theme: 'Commitment', morning: 'Philippians 4:8', night: 'James 1:5' },
    ];
    expect(repairPrayerPlan(rows, phases, 3, 'direction')[0]!.morning).toBe(LIB.constants.open);
  });

  it('fixes a later morning to the phase theme', () => {
    const rows: PrayerWeek[] = [
      { week: 1, theme: 'Commitment', morning: LIB.constants.open, night: 'James 1:5' },
      { week: 2, theme: 'Perseverance', morning: 'Made Up 1:1', night: 'Psalm 25:4-5' },
    ];
    const fixed = repairPrayerPlan(rows, phases, 3, 'direction');
    expect(fixed[1]!.morning).toBe(LIB.themes.Perseverance![0]);
  });

  it('fixes a night reference to the primary why', () => {
    const rows: PrayerWeek[] = [
      { week: 1, theme: 'Commitment', morning: LIB.constants.open, night: 'Not A Ref 9:9' },
    ];
    expect(repairPrayerPlan(rows, phases, 3, 'freedom')[0]!.night).toBe(LIB.why.freedom![0]);
  });

  it('takes a completion passage back off a one week fast', () => {
    const rows: PrayerWeek[] = [
      { week: 1, theme: 'Commitment', morning: LIB.constants.open, night: '2 Timothy 4:7' },
    ];
    expect(repairPrayerPlan(rows, phases, 1, 'nearness')[0]!.night).toBe(LIB.why.nearness![0]);
  });

  it('keeps a completion passage on the last week of a longer fast', () => {
    const rows: PrayerWeek[] = [
      { week: 1, theme: 'Commitment', morning: LIB.constants.open, night: 'Psalm 46:1' },
      { week: 2, theme: 'Perseverance', morning: 'James 1:2-4', night: 'Psalm 62:5-8' },
      { week: 3, theme: 'Renewal', morning: 'Romans 12:1-2', night: '2 Timothy 4:7' },
    ];
    expect(repairPrayerPlan(rows, phases, 3, 'nearness')[2]!.night).toBe('2 Timothy 4:7');
  });

  it('fills a missing week number and theme', () => {
    const rows = [{ morning: 'x', night: 'y' }] as unknown as PrayerWeek[];
    const fixed = repairPrayerPlan(rows, phases, 3, 'nearness')[0]!;
    expect(fixed.week).toBe(1);
    expect(fixed.theme).toBe('Commitment');
    expect(validRef(fixed.morning)).toBe(true);
    expect(validRef(fixed.night)).toBe(true);
  });
});

describe('filterSchedule', () => {
  const rows = [
    { time: '6:40am', action: 'Wake. Feet on the floor.' },
    { time: '7:00am', action: 'Coffee with the morning passage.' },
    { time: '1:30pm', action: 'Charge, ahead of the window.' },
    { time: '10:00pm', action: 'Lights out.' },
  ];

  it('drops rows the fast rules out', () => {
    expect(filterSchedule(rows, ['Genius Joe']).map((r) => r.time)).toEqual([
      '6:40am',
      '1:30pm',
      '10:00pm',
    ]);
    expect(filterSchedule(rows, ['Genius Joe', 'Charge']).map((r) => r.time)).toEqual([
      '6:40am',
      '10:00pm',
    ]);
    expect(filterSchedule(rows, [])).toHaveLength(4);
  });
});

describe('composeFastRow', () => {
  const state = {
    ...initialWizardState(),
    laid: ['Coffee'],
    caffScope: 'all' as const,
    whys: ['direction', 'nearness'],
    exp: 'few' as const,
    matchedId: 'daniel-mourning',
    dur: 21,
    start: '2026-08-01',
    carried: 'cohort' as const,
    takingOn: ['Read to my son'],
    ackAt: '2026-07-22T13:00:00.000Z',
  };
  const pat = pattern('daniel-mourning');
  const plan = buildFallbackPlan({
    pattern: pat,
    duration: 21,
    laid: state.laid,
    whys: state.whys,
    caffScope: state.caffScope,
    anchors: state.anchors,
    takingOn: state.takingOn,
    exclusions: computeExclusions(state.laid, state.caffScope),
    equipped: false,
  });
  const row = composeFastRow(state, pat, plan, {
    productState: 'unequipped',
    prayerId: '904',
    attachedPrayerBody: 'For my brother.',
    todayIso: '2026-07-22',
  });

  it('writes the shape the current app reads', () => {
    expect(row.status).toBe('revealed');
    expect(row.duration).toBe(21);
    expect(row.start_date).toBe('2026-08-01');
    expect(row.carried).toBe('cohort');
    expect(row.exclusions).toEqual(['Genius Joe', 'Charge']);
    expect(row.fast_model).toEqual({
      id: 'daniel-mourning',
      title: "Daniel's 21 Days",
      figure: 'Daniel',
      refs: ['Daniel 10:2-3'],
    });
    expect(row.why).toBe('direction');
    expect(row.prayer_id).toBe('904');
  });

  it('sends the acknowledgment under the column that actually persists', () => {
    expect(row.ack_at).toBe('2026-07-22T13:00:00.000Z');
    expect(row.ack_timestamp).toBe('2026-07-22T13:00:00.000Z');
  });

  it('mirrors into plan the three fields the table has no column for', () => {
    const p = row.plan as Record<string, unknown>;
    expect(p.taking_on).toEqual(['Read to my son']);
    expect(p.attached_prayer_body).toBe('For my brother.');
    expect(p.caff_scope).toBe('all');
    expect(p.carried).toBe('cohort');
    // The plan name is what every later screen displays.
    expect(p.fast_name).toBe("DANIEL'S 21 DAYS");
  });

  it('starts today when no date was chosen and falls back to the pattern length', () => {
    const bare = composeFastRow(
      { ...state, start: null, dur: null },
      pattern('esther'),
      plan,
      { productState: 'equipped', prayerId: null, attachedPrayerBody: '', todayIso: '2026-07-22' },
    );
    expect(bare.start_date).toBe('2026-07-22');
    expect(bare.duration).toBe(3);
    expect(bare.prayer_id).toBeNull();
  });
});

describe('the library itself', () => {
  it('carries nine patterns with valid references and a why apiece', () => {
    expect(FASTS).toHaveLength(9);
    const ids = FASTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(9);
    for (const f of FASTS) {
      expect(f.refs.length).toBeGreaterThan(0);
      expect(f.whys.length).toBeGreaterThan(0);
      expect(f.days).toBeGreaterThan(0);
      expect(f.refs.every((r) => validRef(r))).toBe(true);
      expect(f.title).not.toContain('—');
      expect(f.line).not.toContain('—');
    }
  });

  it('has a scripture set for every why a member can pick', () => {
    for (const key of ['freedom', 'direction', 'nearness', 'intercession', 'repentance', 'preparation']) {
      expect(LIB.why[key]!.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('has a scripture set for every phase theme the ranges produce', () => {
    for (const n of [3, 7, 10, 21, 40]) {
      for (const p of phaseRanges(n)) expect(LIB.themes[p.theme]).toBeTruthy();
    }
  });

  it('finds a pattern by id and nothing else', () => {
    expect(findPattern('esther')?.days).toBe(3);
    expect(findPattern('nope')).toBeNull();
    expect(findPattern(null)).toBeNull();
  });
});

describe('the prompt lines handed to the model', () => {
  const profile = {
    name: 'Jake',
    identityProfile: 'Builder',
    season: 'Rebuild',
    archetype: 'Late Surge',
    recurringPeople: ['Dad', 'Marcus'],
    recurringBurdens: ['the business', 'his father'],
  };

  it('names only the profile facts that exist', () => {
    expect(memberLine(profile)).toBe(
      'Member: Jake, energy pattern Late Surge, profile Builder, season Rebuild.',
    );
    expect(
      memberLine({
        name: '',
        identityProfile: null,
        season: null,
        archetype: null,
        recurringPeople: [],
        recurringBurdens: [],
      }),
    ).toBe('Member: Steward.');
  });

  it('says plainly when the record was not consented to', () => {
    expect(recordLine(false, profile, [{ text: 'anything', tone: 'heavy', burned: false }])).toBe(
      'No record access.',
    );
  });

  it('reports an empty record instead of inventing signals', () => {
    const bare = { ...profile, recurringPeople: [], recurringBurdens: [] };
    expect(recordLine(true, bare, [])).toContain('the record is still empty');
  });

  it('never quotes a burned entry', () => {
    const line = recordLine(true, profile, [
      { text: 'burn this one', tone: 'heavy', burned: true },
      { text: 'keep this one', tone: 'heavy', burned: false },
    ]);
    expect(line).not.toContain('burn this one');
    expect(line).toContain('keep this one');
    expect(line).toContain('1 live entries');
  });

  it('reads a first fast and a broken one differently', () => {
    expect(historyLine(null)).toBe('First fast on record.');
    const line = historyLine(history({ ended_day: 9, finished: false, weak_rule: 'Lights out.' }));
    expect(line).toContain('closed at Day 9 of 21');
    expect(line).toContain('the rule that broke: Lights out.');
    expect(line).toContain('never with shame');
  });

  it('mentions no product to an unequipped member', () => {
    expect(bundleLine(false, 'Boss', ['Genius Joe'], [])).toBe(
      'No products. The plan mentions none.',
    );
  });

  it('drops a placement the fast excluded', () => {
    const line = bundleLine(true, 'Boss', ['Genius Joe', 'Hydration'], ['Genius Joe']);
    expect(line).toContain('Excluded by the fast: Genius Joe');
    expect(line).toContain('Allowed placements: Hydration');
  });
});

describe('readinessRead', () => {
  const entry = (tone: string, text = 'a normal day') => ({ text, tone, burned: false });

  it('stays quiet when the recent record is not stacked', () => {
    expect(readinessRead([entry('mixed'), entry('heavy'), entry('good')])).toBeNull();
  });

  it('warns without blocking once three of the last five carried weight', () => {
    const read = readinessRead([entry('heavy'), entry('heavy'), entry('heavy'), entry('good')]);
    expect(read).toContain('3 of your last 4');
    expect(read).toContain('between you and God');
  });

  it('ignores burned entries when counting the weight', () => {
    const entries = [
      { text: 'heavy', tone: 'heavy', burned: true },
      { text: 'heavy', tone: 'heavy', burned: true },
      { text: 'heavy', tone: 'heavy', burned: true },
      entry('good'),
    ];
    expect(readinessRead(entries)).toBeNull();
  });

  it('reads weight out of the words when the tone does not say so', () => {
    const rough = [
      { text: 'Up at 3 AM again.', tone: 'mixed', burned: false },
      { text: 'Total crash by noon.', tone: 'mixed', burned: false },
      { text: 'Ran on empty all day.', tone: 'mixed', burned: false },
    ];
    expect(readinessRead(rough)).toContain('3 of your last 3');
  });
});

describe('the two lines shown beside a matched pattern', () => {
  it('explains the runner up in terms of the why that was marked first', () => {
    const line = altLine(pattern('esther'), pattern('daniel-mourning'), 'freedom');
    expect(line).toContain('also fit what you carry');
    expect(line).toContain('breaking what owns you');
    expect(line).toContain(`${pattern('daniel-mourning').days} days`);
  });

  it('falls back to the raw why key if it is not one of the six', () => {
    expect(altLine(pattern('esther'), pattern('daniel-mourning'), 'curiosity')).toContain('curiosity');
  });

  it('says nothing about a finished fast or no fast at all', () => {
    expect(unfinishedLine(null)).toBeNull();
    expect(unfinishedLine(history({ finished: true, ended_day: 21 }))).toBeNull();
    expect(unfinishedLine(history({ finished: false, ended_day: null }))).toBeNull();
  });

  it('names the day and the rule that broke, without shame', () => {
    const line = unfinishedLine(history({ finished: false, ended_day: 9, weak_rule: 'Lights out.' }));
    expect(line).toContain('closed at Day 9');
    expect(line).toContain('on lights out');
    expect(line).not.toContain('..');
    expect(line).toContain('accounts for what broke');
  });
});
