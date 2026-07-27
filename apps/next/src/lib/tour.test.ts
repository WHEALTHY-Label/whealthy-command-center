import { describe, expect, it } from 'vitest';
import {
  buildTourSteps,
  emptyProfile,
  FS_KEYS,
  FS_ROUTE_MAP,
  FS_TOUR_LABELS,
  firstUncheckedLabel,
  parseMemberProfile,
  parseTourStateResult,
  prettyArchetype,
  stepForPath,
  type TourContext,
} from './tour';

function ctx(over: Partial<TourContext> = {}): TourContext {
  return {
    firstName: 'Jake',
    archetypeName: 'The Low Floor',
    bundleClaimed: false,
    fastActive: false,
    fastDay: 0,
    fastDuration: 0,
    isAdmin: false,
    wordDay: '',
    firstUnchecked: 'Claim your monthly bundle',
    ...over,
  };
}

describe('FS_ROUTE_MAP', () => {
  it('covers all seven First Steps and nothing else', () => {
    expect(FS_KEYS).toHaveLength(7);
    expect([...Object.values(FS_ROUTE_MAP)].sort()).toEqual([...FS_KEYS].sort());
  });

  it('gives every key a checklist label', () => {
    for (const key of FS_KEYS) {
      expect(FS_TOUR_LABELS[key], key).toBeTruthy();
    }
  });
});

describe('stepForPath', () => {
  it('resolves each mapped route', () => {
    for (const [path, key] of Object.entries(FS_ROUTE_MAP)) {
      expect(stepForPath(path), path).toBe(key);
    }
  });

  // Arriving in the room checks the box, so a nested page inside the room has
  // to count as arriving too.
  it('ignores nested segments and query strings', () => {
    expect(stepForPath('/record/2026-07-22')).toBe('record');
    expect(stepForPath('/fast/build')).toBe('fast');
    expect(stepForPath('/bible?day=12')).toBe('word');
    expect(stepForPath('/claim/')).toBe('bundle');
  });

  it('returns null for the root and for any unmapped room', () => {
    expect(stepForPath('/')).toBeNull();
    expect(stepForPath('')).toBeNull();
    expect(stepForPath('/admin')).toBeNull();
    expect(stepForPath('/rhythm')).toBeNull();
  });

  it('survives a non-string pathname', () => {
    expect(stepForPath(null as unknown as string)).toBeNull();
    expect(stepForPath(undefined as unknown as string)).toBeNull();
  });
});

describe('prettyArchetype', () => {
  it('title-cases a slug or snake key', () => {
    expect(prettyArchetype('low-floor')).toBe('Low Floor');
    expect(prettyArchetype('morning_dependency')).toBe('Morning Dependency');
    expect(prettyArchetype('holding-it-together')).toBe('Holding It Together');
  });

  it('leaves an already readable name alone', () => {
    expect(prettyArchetype('Energy Without Aim')).toBe('Energy Without Aim');
  });

  it('falls back to Steward on nothing usable', () => {
    expect(prettyArchetype(null)).toBe('Steward');
    expect(prettyArchetype('')).toBe('Steward');
    expect(prettyArchetype('   ')).toBe('Steward');
  });
});

describe('parseMemberProfile', () => {
  it('reads a full verify-member payload', () => {
    const got = parseMemberProfile(
      {
        email: 'jake@example.com',
        name: 'Jake Jacobs',
        archetype: 'low-floor',
        archetype_name: 'The Low Floor',
        identity_anchor: 'steward',
        member_status: 'member',
        admin_role: 'owner',
        tour_done_at: '2026-07-01T12:00:00Z',
        first_steps: { bundle: true, word: true },
      },
      'fallback@example.com',
    );
    expect(got).toEqual({
      email: 'jake@example.com',
      name: 'Jake Jacobs',
      firstName: 'Jake',
      archetype: 'low-floor',
      archetypeName: 'The Low Floor',
      identityAnchor: 'steward',
      memberStatus: 'member',
      adminRole: 'owner',
      tourDoneAt: '2026-07-01T12:00:00Z',
      firstSteps: { bundle: true, word: true },
    });
  });

  it('falls back to the session email when the row has none', () => {
    expect(parseMemberProfile({}, 'me@example.com').email).toBe('me@example.com');
    expect(parseMemberProfile({ email: '   ' }, 'me@example.com').email).toBe('me@example.com');
  });

  it('capitalises the first name and defaults it to Steward', () => {
    expect(parseMemberProfile({ name: 'jake jacobs' }, '').firstName).toBe('Jake');
    expect(parseMemberProfile({ name: '  marcus  ' }, '').firstName).toBe('Marcus');
    expect(parseMemberProfile({}, '').firstName).toBe('Steward');
    expect(parseMemberProfile({}, '').name).toBe('Steward');
  });

  it('derives the archetype name from the key when the row has no name', () => {
    expect(parseMemberProfile({ archetype: 'energy-without-aim' }, '').archetypeName).toBe(
      'Energy Without Aim',
    );
    expect(parseMemberProfile({}, '').archetypeName).toBe('Steward');
  });

  // The gate reads `archetype`, so a blank must stay null rather than becoming
  // an empty string that reads as scored.
  it('keeps an unscored member unscored', () => {
    expect(parseMemberProfile({ archetype: '' }, '').archetype).toBeNull();
    expect(parseMemberProfile({ archetype: '  ' }, '').archetype).toBeNull();
    expect(parseMemberProfile({ archetype: 42 }, '').archetype).toBeNull();
  });

  it('keeps only the steps that are literally true', () => {
    const got = parseMemberProfile(
      { first_steps: { bundle: true, word: false, wall: 'true', record: 1, code: null } },
      '',
    );
    expect(got.firstSteps).toEqual({ bundle: true });
  });

  it('survives a first_steps that is not an object', () => {
    expect(parseMemberProfile({ first_steps: null }, '').firstSteps).toEqual({});
    expect(parseMemberProfile({ first_steps: ['bundle'] }, '').firstSteps).toEqual({});
    expect(parseMemberProfile({ first_steps: 'bundle' }, '').firstSteps).toEqual({});
  });

  it('survives a payload that is not an object at all', () => {
    expect(parseMemberProfile(null, 'me@example.com').email).toBe('me@example.com');
    expect(parseMemberProfile(undefined, 'me@example.com').firstName).toBe('Steward');
  });
});

describe('emptyProfile', () => {
  it('is what the app shows when verify-member is unreachable', () => {
    const got = emptyProfile('me@example.com');
    expect(got.email).toBe('me@example.com');
    expect(got.archetype).toBeNull();
    expect(got.adminRole).toBeNull();
    expect(got.tourDoneAt).toBeNull();
    expect(got.firstSteps).toEqual({});
  });

  // An unreachable function must not accidentally hand out the admin surface.
  it('never grants admin', () => {
    expect(emptyProfile('me@example.com').adminRole).toBeNull();
  });
});

describe('parseTourStateResult', () => {
  it('picks out just the two fields a write returns', () => {
    expect(
      parseTourStateResult({
        tour_done_at: '2026-07-02T00:00:00Z',
        first_steps: { record: true, fast: false },
        email: 'ignored@example.com',
      }),
    ).toEqual({ tourDoneAt: '2026-07-02T00:00:00Z', firstSteps: { record: true } });
  });

  it('degrades safely on an empty or missing response', () => {
    expect(parseTourStateResult(null)).toEqual({ tourDoneAt: null, firstSteps: {} });
    expect(parseTourStateResult({})).toEqual({ tourDoneAt: null, firstSteps: {} });
  });
});

describe('firstUncheckedLabel', () => {
  it('names the first step in FS_KEYS order that is not done', () => {
    expect(firstUncheckedLabel({})).toBe(FS_TOUR_LABELS.bundle);
    expect(firstUncheckedLabel({ bundle: true })).toBe(FS_TOUR_LABELS.word);
    expect(firstUncheckedLabel({ bundle: true, word: true })).toBe(FS_TOUR_LABELS.wall);
  });

  it('ignores a later step that is done while an earlier one is not', () => {
    expect(firstUncheckedLabel({ code: true })).toBe(FS_TOUR_LABELS.bundle);
  });

  it('falls back to the bundle once everything is done', () => {
    const all = Object.fromEntries(FS_KEYS.map((k) => [k, true]));
    expect(firstUncheckedLabel(all)).toBe(FS_TOUR_LABELS.bundle);
  });

  it('survives an absent flag map', () => {
    expect(firstUncheckedLabel(undefined)).toBe(FS_TOUR_LABELS.bundle);
  });
});

describe('buildTourSteps', () => {
  it('opens on a centered card and closes on one', () => {
    const steps = buildTourSteps(ctx());
    expect(steps.length).toBeGreaterThan(10);
    expect(steps[0]?.target).toBeNull();
    expect(steps[steps.length - 1]?.target).toBeNull();
  });

  it('gives every card a title and a body', () => {
    for (const step of buildTourSteps(ctx({ isAdmin: true }))) {
      expect(step.title, step.title).toBeTruthy();
      expect(step.body.length, step.title).toBeGreaterThan(10);
    }
  });

  it('hides the admin card from a member and shows it to an admin', () => {
    const member = buildTourSteps(ctx({ isAdmin: false }));
    const admin = buildTourSteps(ctx({ isAdmin: true }));
    expect(member.some((s) => s.adminOnly)).toBe(false);
    expect(member.some((s) => s.target === '/admin')).toBe(false);
    expect(admin.filter((s) => s.adminOnly)).toHaveLength(1);
    expect(admin).toHaveLength(member.length + 1);
  });

  it('greets the member by name and by pattern', () => {
    const steps = buildTourSteps(ctx({ firstName: 'Marcus', archetypeName: 'Energy Without Aim' }));
    expect(steps[0]?.title).toBe('Energy Without Aim.');
    expect(steps[0]?.body).toContain('Marcus');
  });

  it('speaks differently about a claimed bundle', () => {
    const unclaimed = buildTourSteps(ctx()).find((s) => s.target === '/claim');
    const claimed = buildTourSteps(ctx({ bundleClaimed: true })).find((s) => s.target === '/claim');
    expect(unclaimed?.body).toContain('waiting');
    expect(claimed?.body).toContain('claimed');
  });

  it('names the day when a fast is running', () => {
    const idle = buildTourSteps(ctx()).find((s) => s.target === '/fast');
    const running = buildTourSteps(
      ctx({ fastActive: true, fastDay: 4, fastDuration: 21 }),
    ).find((s) => s.target === '/fast');
    expect(idle?.body).not.toContain('Day');
    expect(running?.body).toContain('Day 4 of 21');
  });

  it('names the reading day only when there is one', () => {
    expect(buildTourSteps(ctx()).find((s) => s.target === '/bible')?.body).not.toContain('Day');
    expect(
      buildTourSteps(ctx({ wordDay: '12' })).find((s) => s.target === '/bible')?.body,
    ).toContain('Day 12');
  });

  it('points the finish card at the first unfinished step', () => {
    const steps = buildTourSteps(ctx({ firstUnchecked: "Open today's Word" }));
    const last = steps[steps.length - 1];
    expect(last?.body).toContain("Open today's Word");
    expect(last?.nextLabel).toBe('Start my First Steps');
    expect(last?.skipLabel).toBeNull();
  });

  it('lets the member skip only from the opening card', () => {
    const steps = buildTourSteps(ctx({ isAdmin: true }));
    expect(steps[0]?.skipLabel).toBe('I know the house');
    for (const step of steps.slice(1, -1)) {
      expect(step.skipLabel, step.title).toBeUndefined();
    }
  });

  it('spotlights each room at most once', () => {
    const targets = buildTourSteps(ctx({ isAdmin: true }))
      .map((s) => s.target)
      .filter((t): t is string => t !== null);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('includes My Rhythm, which the live tour predates', () => {
    expect(buildTourSteps(ctx()).some((s) => s.target === '/rhythm')).toBe(true);
  });
});
