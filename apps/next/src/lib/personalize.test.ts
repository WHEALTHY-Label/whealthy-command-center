import { describe, expect, it } from 'vitest';
import {
  allowCommunityDirective,
  bibleContextLine,
  buildSynthesisPrompt,
  entriesBlock,
  fastContextLine,
  habitsContextLine,
  journalContextLine,
  mentionsWall,
  NO_JOURNAL,
  parseJournalEntries,
  parsePersonalization,
  timeGreeting,
  type JournalEntry,
} from './personalize';

describe('timeGreeting', () => {
  it('uses the live app thresholds', () => {
    expect(timeGreeting(5)).toBe('Good morning');
    expect(timeGreeting(11)).toBe('Good morning');
    expect(timeGreeting(12)).toBe('Good afternoon');
    expect(timeGreeting(16)).toBe('Good afternoon');
    expect(timeGreeting(17)).toBe('Good evening');
    expect(timeGreeting(21)).toBe('Good evening');
  });

  it('falls back outside the three named windows', () => {
    expect(timeGreeting(22)).toBe('Welcome back');
    expect(timeGreeting(23)).toBe('Welcome back');
    expect(timeGreeting(0)).toBe('Welcome back');
    expect(timeGreeting(4)).toBe('Welcome back');
  });

  it('never returns an empty greeting for a junk hour', () => {
    expect(timeGreeting(Number.NaN)).toBe('Welcome back');
    expect(timeGreeting(Number.POSITIVE_INFINITY)).toBe('Welcome back');
    expect(timeGreeting(-3)).toBe('Welcome back');
    expect(timeGreeting(99)).toBe('Welcome back');
  });
});

describe('fastContextLine', () => {
  it('says there is no fast when there is no fast', () => {
    expect(fastContextLine(null)).toBe('No active fast');
    expect(fastContextLine({ day: 0, duration: 21 })).toBe('No active fast');
  });

  it('reports the day, the target and the phase', () => {
    expect(fastContextLine({ day: 4, duration: 21, phase: 'Consecration' })).toBe(
      'Active fast: day 4, target duration: 21 days. Current phase: Consecration',
    );
  });

  it('falls back to stewardship when no phase came through', () => {
    expect(fastContextLine({ day: 2, duration: 0, phase: '  ' })).toBe(
      'Active fast: day 2. Current phase: stewardship',
    );
  });
});

describe('bibleContextLine', () => {
  it('says there is no reading when the study has not begun', () => {
    expect(bibleContextLine(null)).toBe('No active reading');
  });

  it('reports the streak and whether today is kept', () => {
    expect(bibleContextLine({ streak: 9, completedToday: true })).toBe(
      'Bible reading streak: 9 days. Completed today: yes',
    );
    expect(bibleContextLine({ streak: 0, completedToday: false })).toBe(
      'Bible reading streak: 0 days. Completed today: no',
    );
  });

  it('never reports a negative streak', () => {
    expect(bibleContextLine({ streak: -4, completedToday: false })).toContain('streak: 0 days');
  });
});

describe('habitsContextLine', () => {
  it('says nothing was logged when there is no rhythm', () => {
    expect(habitsContextLine(0, 0)).toBe('No habits logged today');
    expect(habitsContextLine(3, 0)).toBe('No habits logged today');
  });

  it('counts kept against total', () => {
    expect(habitsContextLine(2, 5)).toBe('2 of 5 daily directives completed today');
  });

  it('cannot report more kept than exist', () => {
    expect(habitsContextLine(9, 5)).toBe('5 of 5 daily directives completed today');
  });
});

describe('entriesBlock', () => {
  const entries: JournalEntry[] = [
    { entryDate: '2026-07-20', text: 'Held the line.', fastDay: null, burned: false },
    { entryDate: '2026-07-21', text: 'Slipped at noon.', fastDay: 3, burned: false },
    { entryDate: '2026-07-22', text: 'Private.', fastDay: null, burned: true },
    { entryDate: '2026-07-23', text: '   ', fastDay: null, burned: false },
  ];

  it('drops burned and blank entries and annotates the fast day', () => {
    expect(entriesBlock(entries)).toBe(
      '[2026-07-20] Held the line.\n[2026-07-21] (fast day 3) Slipped at noon.',
    );
  });

  it('is empty when everything was burned', () => {
    expect(entriesBlock([{ entryDate: '2026-07-22', text: 'x', fastDay: 1, burned: true }])).toBe(
      '',
    );
  });
});

describe('journalContextLine', () => {
  it('says entries are inaccessible rather than pretending there are none', () => {
    expect(journalContextLine([])).toBe(NO_JOURNAL);
    expect(journalContextLine([{ entryDate: 'd', text: 't', fastDay: null, burned: true }])).toBe(
      NO_JOURNAL,
    );
  });

  it('labels the block when there is one', () => {
    const out = journalContextLine([
      { entryDate: '2026-07-20', text: 'Held the line.', fastDay: null, burned: false },
    ]);
    expect(out).toBe("Steward's recent non-burned journal entries:\n[2026-07-20] Held the line.");
  });
});

describe('parseJournalEntries', () => {
  it('reads the governor-state load payload', () => {
    const parsed = parseJournalEntries({
      entries: [
        { entry_date: '2026-07-20', text: 'One', fast_day: 2, burned: false },
        { entry_date: '2026-07-21', burned: true },
        { text: 'no date' },
        null,
        7,
      ],
    });
    expect(parsed).toEqual([
      { entryDate: '2026-07-20', text: 'One', fastDay: 2, burned: false },
      { entryDate: '2026-07-21', text: '', fastDay: null, burned: true },
    ]);
  });

  it('returns nothing for junk', () => {
    expect(parseJournalEntries(null)).toEqual([]);
    expect(parseJournalEntries({ entries: 'nope' })).toEqual([]);
    expect(parseJournalEntries('nope')).toEqual([]);
  });
});

describe('buildSynthesisPrompt', () => {
  const ctx = {
    name: 'Ignacio',
    archetype: 'The Builder',
    hour: 19,
    fastInfo: 'No active fast',
    bibleInfo: 'Bible reading streak: 4 days. Completed today: yes',
    habitsInfo: '2 of 5 daily directives completed today',
    journalContext: NO_JOURNAL,
  };

  it('carries every context line into the prompt', () => {
    const p = buildSynthesisPrompt(ctx);
    expect(p).toContain('- Name: Ignacio');
    expect(p).toContain('- Archetype: The Builder');
    expect(p).toContain('- Current Local Time of Day: Good evening (Hour: 19)');
    expect(p).toContain('- Fast status: No active fast');
    expect(p).toContain('- Bible reading status: Bible reading streak: 4 days');
    expect(p).toContain('- Directives logged: 2 of 5 daily directives completed today');
    expect(p).toContain(`- Journal entries: ${NO_JOURNAL}`);
  });

  it('asks for the greeting the local hour actually earns', () => {
    expect(buildSynthesisPrompt({ ...ctx, hour: 8 })).toContain(
      '"dashTitle": "Good morning, [Name]"',
    );
    expect(buildSynthesisPrompt({ ...ctx, hour: 2 })).toContain(
      '"dashTitle": "Welcome back, [Name]"',
    );
  });

  it('asks for all nine fields', () => {
    const p = buildSynthesisPrompt(ctx);
    for (const field of [
      'dashTitle',
      'dashSubtitle',
      'dailyDirective',
      'bibleTitle',
      'bibleSubtitle',
      'fastTitle',
      'fastSubtitle',
      'recordTitle',
      'recordSubtitle',
    ]) {
      expect(p).toContain(`"${field}"`);
    }
  });

  it('contains no em dash, which the function rejects and retries on', () => {
    expect(buildSynthesisPrompt(ctx)).not.toContain('—');
  });
});

describe('parsePersonalization', () => {
  it('reads the nine fields', () => {
    const p = parsePersonalization({
      dashTitle: 'Good evening, Ignacio',
      dashSubtitle: 'Lay the day down.',
      dailyDirective: 'Close the loop on one open thing before bed.',
      bibleTitle: 'Bible 365',
      bibleSubtitle: 'Four days kept.',
      fastTitle: 'The Fast',
      fastSubtitle: 'Not yet begun.',
      recordTitle: "Steward's Journal",
      recordSubtitle: 'Two directives left.',
    });
    expect(p?.dashTitle).toBe('Good evening, Ignacio');
    expect(p?.dailyDirective).toBe('Close the loop on one open thing before bed.');
    expect(p?.recordSubtitle).toBe('Two directives left.');
  });

  it('keeps a partial answer and nulls the rest', () => {
    const p = parsePersonalization({ dailyDirective: '  Drink before you drive.  ' });
    expect(p?.dailyDirective).toBe('Drink before you drive.');
    expect(p?.dashTitle).toBeNull();
    expect(p?.fastSubtitle).toBeNull();
  });

  it('parses a JSON string if one is passed through', () => {
    expect(parsePersonalization('{"dashTitle":"Good morning, Ignacio"}')?.dashTitle).toBe(
      'Good morning, Ignacio',
    );
  });

  it('returns null rather than a blank card', () => {
    expect(parsePersonalization(null)).toBeNull();
    expect(parsePersonalization('not json')).toBeNull();
    expect(parsePersonalization([])).toBeNull();
    expect(parsePersonalization({})).toBeNull();
    expect(parsePersonalization({ dashTitle: '   ', dailyDirective: '' })).toBeNull();
    expect(parsePersonalization({ dashTitle: 42 })).toBeNull();
  });
});

describe('allowCommunityDirective', () => {
  const now = Date.parse('2026-07-22T12:00:00Z');

  it('allows the nudge when it has never been shown', () => {
    expect(allowCommunityDirective(null, now)).toBe(true);
    expect(allowCommunityDirective('', now)).toBe(true);
  });

  it('holds the nudge for five days', () => {
    expect(allowCommunityDirective('2026-07-20T12:00:00Z', now)).toBe(false);
    expect(allowCommunityDirective('2026-07-18T12:00:01Z', now)).toBe(false);
  });

  it('opens again at five days', () => {
    expect(allowCommunityDirective('2026-07-17T12:00:00Z', now)).toBe(true);
    expect(allowCommunityDirective('2026-06-01T12:00:00Z', now)).toBe(true);
  });

  it('blocks on an unparseable stamp, like the legacy NaN comparison', () => {
    expect(allowCommunityDirective('yesterday', now)).toBe(false);
  });
});

describe('mentionsWall', () => {
  it('spots the three legacy words, case insensitively', () => {
    expect(mentionsWall('Bring it to the Wall today.')).toBe(true);
    expect(mentionsWall('Hand the BURDEN over.')).toBe(true);
    expect(mentionsWall('Let someone help you carry it.')).toBe(true);
  });

  it('is false otherwise', () => {
    expect(mentionsWall('Front load your water before ten.')).toBe(false);
    expect(mentionsWall(null)).toBe(false);
    expect(mentionsWall('')).toBe(false);
  });
});
