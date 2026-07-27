import { describe, expect, it } from 'vitest';
import {
  buildRouterPrompt,
  coerceForSurface,
  GOVERNOR_INTENTS,
  GUARDED_INTENTS,
  NAV_MAP,
  parseIntent,
  planDispatch,
  REPORT_OPEN_MIN,
  reportOpenAt,
  resolveDatePhrase,
  resolveNav,
  type DispatchInput,
  type GovernorContext,
  type GovernorIntent,
  type GovernorIntentId,
} from './governorIntent';

function intent(partial: Partial<GovernorIntent> = {}): GovernorIntent {
  return {
    intent: 'unknown',
    confidence: 1,
    slots: {},
    speakBack: '',
    scriptureRef: '',
    needsConfirm: false,
    ...partial,
  };
}

/** 2026-07-22 is a Wednesday, which the weekday walk-back cases lean on. */
const TODAY = '2026-07-22';

function dispatchInput(partial: Partial<DispatchInput> = {}): DispatchInput {
  return { intent: intent(), todayIso: TODAY, localMinutes: 600, ...partial };
}

describe('parseIntent', () => {
  it('keeps a well formed router response intact', () => {
    const got = parseIntent({
      intent: 'nav_go',
      confidence: 0.82,
      slots: { destination: 'the record' },
      speak_back: '  Moving.  ',
      scripture_ref: 'Prov 27:23',
      needs_confirm: false,
    });
    expect(got).toEqual({
      intent: 'nav_go',
      confidence: 0.82,
      slots: { destination: 'the record' },
      speakBack: 'Moving.',
      scriptureRef: 'Prov 27:23',
      needsConfirm: false,
    });
  });

  it('degrades an unrecognised intent id to unknown', () => {
    expect(parseIntent({ intent: 'delete_everything' }).intent).toBe('unknown');
    expect(parseIntent({ intent: 42 }).intent).toBe('unknown');
    expect(parseIntent({}).intent).toBe('unknown');
    expect(parseIntent(null).intent).toBe('unknown');
    expect(parseIntent(undefined).intent).toBe('unknown');
  });

  it('accepts every declared intent id', () => {
    for (const id of GOVERNOR_INTENTS) {
      expect(parseIntent({ intent: id }).intent).toBe(id);
    }
  });

  // Defect 3. The whole point of the re-application: a compromised or simply
  // wrong router must not be able to skip the prompt on a destructive action.
  it('re-applies the guard on every guarded intent even when the router says no', () => {
    for (const id of GUARDED_INTENTS) {
      const got = parseIntent({ intent: id, needs_confirm: false });
      expect(got.needsConfirm, `${id} must stay guarded`).toBe(true);
    }
  });

  it('names exactly the five guarded intents', () => {
    expect([...GUARDED_INTENTS].sort()).toEqual([
      'commerce_claim',
      'community_draft_invite',
      'fast_end',
      'fast_start',
      'record_burn_entry',
    ]);
  });

  it('still honours needs_confirm on an unguarded intent', () => {
    expect(parseIntent({ intent: 'journal_entry', needs_confirm: true }).needsConfirm).toBe(true);
    expect(parseIntent({ intent: 'journal_entry', needs_confirm: false }).needsConfirm).toBe(false);
    // Only a literal true counts, so a truthy string cannot force a prompt.
    expect(parseIntent({ intent: 'journal_entry', needs_confirm: 'yes' }).needsConfirm).toBe(false);
  });

  it('clamps confidence into [0,1] and defaults a missing or unusable one to 0', () => {
    expect(parseIntent({ confidence: 1.7 }).confidence).toBe(1);
    expect(parseIntent({ confidence: -3 }).confidence).toBe(0);
    expect(parseIntent({ confidence: 0.5 }).confidence).toBe(0.5);
    expect(parseIntent({ confidence: '0.9' }).confidence).toBe(0);
    expect(parseIntent({ confidence: Number.NaN }).confidence).toBe(0);
    expect(parseIntent({ confidence: Number.POSITIVE_INFINITY }).confidence).toBe(0);
    expect(parseIntent({}).confidence).toBe(0);
  });

  it('degrades non-object slots to an empty object', () => {
    expect(parseIntent({ slots: null }).slots).toEqual({});
    expect(parseIntent({ slots: 'when' }).slots).toEqual({});
    expect(parseIntent({ slots: ['when'] }).slots).toEqual({});
    expect(parseIntent({ slots: { when: 'yesterday' } }).slots).toEqual({ when: 'yesterday' });
  });

  it('trims the spoken text and empties any non-string', () => {
    expect(parseIntent({ speak_back: '  held  ' }).speakBack).toBe('held');
    expect(parseIntent({ speak_back: 12 }).speakBack).toBe('');
    expect(parseIntent({ scripture_ref: null }).scriptureRef).toBe('');
  });
});

describe('coerceForSurface', () => {
  const chatty = intent({ intent: 'ambient_support', speakBack: 'held', needsConfirm: true });

  it('leaves the floating Governor alone', () => {
    expect(coerceForSurface(chatty, 'governor', 'record')).toBe(chatty);
  });

  it('leaves the record mic alone when the steward is looking elsewhere', () => {
    expect(coerceForSurface(chatty, 'record', 'fast')).toBe(chatty);
  });

  it('files anything else spoken into the record mic as a journal entry', () => {
    const got = coerceForSurface(chatty, 'record', 'record');
    expect(got.intent).toBe('journal_entry');
    expect(got.needsConfirm).toBe(false);
    expect(got.speakBack).toBe('held');
  });

  it('keeps the four unmistakable commands', () => {
    const keeps: GovernorIntentId[] = [
      'record_burn_entry',
      'fast_end',
      'record_read_entry',
      'nav_go',
    ];
    for (const id of keeps) {
      const src = intent({ intent: id, needsConfirm: true });
      expect(coerceForSurface(src, 'record', 'record'), id).toBe(src);
    }
  });
});

describe('resolveNav', () => {
  it('maps every spoken destination in the table', () => {
    for (const [spoken, href] of Object.entries(NAV_MAP)) {
      expect(resolveNav(spoken), spoken).toBe(href);
    }
  });

  it('strips a leading "the", uppercase and inner whitespace', () => {
    expect(resolveNav('The Record')).toBe('/record');
    expect(resolveNav('  the   circles  ')).toBe('/circle');
    expect(resolveNav('TRY ALL')).toBe('/tryall');
  });

  it('sends an unknown or missing destination home', () => {
    expect(resolveNav('the moon')).toBe('/');
    expect(resolveNav('')).toBe('/');
    expect(resolveNav(undefined)).toBe('/');
    expect(resolveNav(7)).toBe('/');
  });

  it('only strips "the" when it is a separate leading word', () => {
    expect(resolveNav('theme')).toBe('/');
  });
});

describe('resolveDatePhrase', () => {
  it('refuses to guess when the caller has not supplied a local today', () => {
    expect(resolveDatePhrase('today', '')).toBeNull();
    expect(resolveDatePhrase('today', '22/07/2026')).toBeNull();
    expect(resolveDatePhrase('today', '2026-7-22')).toBeNull();
  });

  // Defect 2. The caller owns the local date, so an evening burn west of
  // Greenwich lands on the row the steward means.
  it('reads today, tonight and an empty phrase as the local today', () => {
    expect(resolveDatePhrase('today', TODAY)).toBe(TODAY);
    expect(resolveDatePhrase('Tonight', TODAY)).toBe(TODAY);
    expect(resolveDatePhrase('', TODAY)).toBe(TODAY);
    expect(resolveDatePhrase(undefined, TODAY)).toBe(TODAY);
  });

  it('walks back one day for yesterday', () => {
    expect(resolveDatePhrase('yesterday', TODAY)).toBe('2026-07-21');
    expect(resolveDatePhrase('yesterday', '2026-01-01')).toBe('2025-12-31');
  });

  it('counts back N days and refuses an implausible N', () => {
    expect(resolveDatePhrase('3 days ago', TODAY)).toBe('2026-07-19');
    expect(resolveDatePhrase('1 day ago', TODAY)).toBe('2026-07-21');
    expect(resolveDatePhrase('366 days ago', TODAY)).toBe('2025-07-21');
    expect(resolveDatePhrase('900 days ago', TODAY)).toBeNull();
  });

  it('walks back to the most recent named weekday', () => {
    // 2026-07-22 is a Wednesday.
    expect(resolveDatePhrase('tuesday', TODAY)).toBe('2026-07-21');
    expect(resolveDatePhrase('last monday', TODAY)).toBe('2026-07-20');
    expect(resolveDatePhrase('Thursday', TODAY)).toBe('2026-07-16');
    // Never resolves to today itself, so "wednesday" means the one before.
    expect(resolveDatePhrase('wednesday', TODAY)).toBe('2026-07-15');
  });

  it('passes a bare ISO date straight through', () => {
    expect(resolveDatePhrase('2026-03-04', TODAY)).toBe('2026-03-04');
  });

  it('returns null on a phrase it cannot read', () => {
    expect(resolveDatePhrase('the one about my father', TODAY)).toBeNull();
    expect(resolveDatePhrase('next tuesday', TODAY)).toBeNull();
  });

  it('treats a non-string slot the same as an absent one', () => {
    // A missing `when` means tonight, and a slot of the wrong type carries no
    // more information than a missing one. The only caller is the burn
    // proposal, which names the resolved date and waits for a confirmation.
    expect(resolveDatePhrase(42, TODAY)).toBe(TODAY);
    expect(resolveDatePhrase(null, TODAY)).toBe(TODAY);
  });
});

describe('reportOpenAt', () => {
  it('opens at 8:45 PM local and not a minute before', () => {
    expect(REPORT_OPEN_MIN).toBe(1245);
    expect(reportOpenAt(1244)).toBe(false);
    expect(reportOpenAt(1245)).toBe(true);
    expect(reportOpenAt(1439)).toBe(true);
    expect(reportOpenAt(0)).toBe(false);
  });
});

describe('planDispatch', () => {
  it('files a journal entry and always says something', () => {
    expect(planDispatch(dispatchInput({ intent: intent({ intent: 'journal_entry' }) }))).toEqual({
      kind: 'journal',
      href: null,
      message: 'Keeping your record.',
    });
    const spoken = planDispatch(
      dispatchInput({ intent: intent({ intent: 'journal_entry', speakBack: 'Held.' }) }),
    );
    expect(spoken.message).toBe('Held.');
  });

  // Defect 1. The live app threw a ReferenceError here and dropped the words.
  it('keeps the words when it did not understand the command', () => {
    expect(planDispatch(dispatchInput({ intent: intent({ intent: 'unknown' }) }))).toEqual({
      kind: 'journal',
      href: null,
      message: 'Not sure what that was, so I kept it.',
    });
  });

  it('opens the record for every read intent', () => {
    const reads: GovernorIntentId[] = [
      'record_read_entry',
      'record_query_thread',
      'record_read_map',
      'record_when_last',
    ];
    for (const id of reads) {
      expect(planDispatch(dispatchInput({ intent: intent({ intent: id }) })), id).toEqual({
        kind: 'navigate',
        href: '/record',
        message: 'Opening the record.',
      });
    }
  });

  it('proposes a burn rather than performing one, naming the date', () => {
    const got = planDispatch(
      dispatchInput({
        intent: intent({ intent: 'record_burn_entry', slots: { when: 'yesterday' } }),
      }),
    );
    expect(got.kind).toBe('confirm');
    expect(got.href).toBeNull();
    expect(got.entryDate).toBe('2026-07-21');
    expect(got.confirmLabel).toBe('Confirm burn');
    expect(got.message).toContain('2026-07-21');
    expect(got.onConfirm).toEqual({
      kind: 'burn',
      href: '/record',
      message: 'The entry is gone.',
      entryDate: '2026-07-21',
    });
  });

  it('falls back to today when the burn date cannot be read', () => {
    const got = planDispatch(
      dispatchInput({
        intent: intent({ intent: 'record_burn_entry', slots: { when: 'the one about work' } }),
      }),
    );
    expect(got.entryDate).toBe(TODAY);
    expect(got.onConfirm?.entryDate).toBe(TODAY);
  });

  it('proposes starting and ending a fast', () => {
    const start = planDispatch(dispatchInput({ intent: intent({ intent: 'fast_start' }) }));
    expect(start.kind).toBe('confirm');
    expect(start.confirmLabel).toBe('Set it up');
    expect(start.onConfirm).toEqual({
      kind: 'navigate',
      href: '/fast/build',
      message: 'Opening the fast.',
    });

    const end = planDispatch(dispatchInput({ intent: intent({ intent: 'fast_end' }) }));
    expect(end.kind).toBe('confirm');
    expect(end.confirmLabel).toBe('End the fast');
    expect(end.onConfirm?.href).toBe('/fast');
  });

  it('opens the fast for every read-only fast intent', () => {
    const reads: GovernorIntentId[] = [
      'fast_status',
      'fast_directive_today',
      'fast_read_passage',
      'fast_how_am_i_doing',
      'fast_mark_report',
      'fast_whats_the_fight',
    ];
    for (const id of reads) {
      const got = planDispatch(dispatchInput({ intent: intent({ intent: id }) }));
      expect(got, id).toEqual({ kind: 'navigate', href: '/fast', message: 'Opening the fast.' });
    }
  });

  it('opens the Word for every scripture intent', () => {
    const reads: GovernorIntentId[] = [
      'scripture_read',
      'scripture_find_theme',
      'scripture_for_me',
      'bible_todays_reading',
    ];
    for (const id of reads) {
      const got = planDispatch(dispatchInput({ intent: intent({ intent: id }) }));
      expect(got, id).toEqual({
        kind: 'navigate',
        href: '/bible',
        message: "Opening today's Word.",
      });
    }
  });

  it('navigates where the steward named, and home when it cannot tell', () => {
    expect(
      planDispatch(
        dispatchInput({ intent: intent({ intent: 'nav_go', slots: { destination: 'the wall' } }) }),
      ),
    ).toEqual({ kind: 'navigate', href: '/wall', message: 'Moving.' });
    expect(
      planDispatch(
        dispatchInput({ intent: intent({ intent: 'nav_go', slots: { destination: 'nowhere' } }) }),
      ).href,
    ).toBe('/');
  });

  it('assembles the briefing from the state it was handed', () => {
    const got = planDispatch(
      dispatchInput({
        intent: intent({ intent: 'daily_briefing' }),
        fastDay: 3,
        fastDuration: 21,
        filedToday: true,
        localMinutes: 1300,
      }),
    );
    expect(got.kind).toBe('speak');
    expect(got.message).toBe(
      'Here is your daily briefing. You are on Day 3 of 21. ' +
        "Tonight's entry has been filed. The nightly report is open.",
    );
  });

  it('leaves the fast line out when there is no fast, and holds the report shut before 8:45', () => {
    const got = planDispatch(
      dispatchInput({ intent: intent({ intent: 'daily_briefing' }), localMinutes: 1244 }),
    );
    expect(got.message).toBe(
      'Here is your daily briefing. ' +
        "Tonight's entry is open. The nightly report opens at 8:45 PM.",
    );
  });

  it('reads back the bundle, or points at the claim page', () => {
    expect(
      planDispatch(
        dispatchInput({
          intent: intent({ intent: 'commerce_read_bundle' }),
          bundleName: 'The Boss',
        }),
      ),
    ).toEqual({ kind: 'speak', href: null, message: 'Your current bundle is The Boss.' });
    expect(
      planDispatch(dispatchInput({ intent: intent({ intent: 'commerce_read_bundle' }) })).message,
    ).toBe('No bundle is set up yet. The claim page will start one.');
  });

  it('proposes the claim rather than opening it', () => {
    const got = planDispatch(dispatchInput({ intent: intent({ intent: 'commerce_claim' }) }));
    expect(got.kind).toBe('confirm');
    expect(got.confirmLabel).toBe('Take me there');
    expect(got.onConfirm).toEqual({
      kind: 'navigate',
      href: '/claim',
      message: 'Opening the claim page.',
    });
  });

  it('reads the affiliate link back, or sends the steward to make one', () => {
    expect(
      planDispatch(
        dispatchInput({
          intent: intent({ intent: 'affiliate_read_link' }),
          affiliateLink: 'whealthy.co/jake',
        }),
      ),
    ).toEqual({ kind: 'speak', href: null, message: 'Your link is whealthy.co/jake.' });
    expect(
      planDispatch(dispatchInput({ intent: intent({ intent: 'affiliate_read_link' }) })),
    ).toEqual({ kind: 'navigate', href: '/affiliate', message: 'Generate your link first.' });
  });

  it('names who the invite is for, and has a name for when it does not know', () => {
    const named = planDispatch(
      dispatchInput({
        intent: intent({ intent: 'community_draft_invite', slots: { who: ' Marcus ' } }),
      }),
    );
    expect(named.kind).toBe('confirm');
    expect(named.message).toContain('Marcus');
    expect(named.confirmLabel).toBe('Draft it');
    expect(named.onConfirm?.href).toBe('/community');

    const unnamed = planDispatch(
      dispatchInput({ intent: intent({ intent: 'community_draft_invite' }) }),
    );
    expect(unnamed.message).toContain('your friend');
  });

  it('stays put and speaks on ambient support', () => {
    expect(planDispatch(dispatchInput({ intent: intent({ intent: 'ambient_support' }) }))).toEqual({
      kind: 'speak',
      href: null,
      message: 'We keep the record to govern the rhythm. Your words are held.',
    });
  });

  it('never returns an empty message for any intent', () => {
    for (const id of GOVERNOR_INTENTS) {
      const got = planDispatch(dispatchInput({ intent: intent({ intent: id }) }));
      expect(got.message.length, id).toBeGreaterThan(0);
    }
  });

  it('only ever proposes, never performs, for the guarded intents', () => {
    for (const id of GUARDED_INTENTS) {
      const got = planDispatch(dispatchInput({ intent: intent({ intent: id }) }));
      expect(got.kind, id).toBe('confirm');
      expect(got.onConfirm, id).toBeDefined();
      expect(got.confirmLabel, id).toBeTruthy();
    }
  });
});

describe('buildRouterPrompt', () => {
  const ctx: GovernorContext = {
    currentView: 'record',
    fastState: 'active',
    reportOpen: 'closed until 8:45pm',
    filedToday: 'no',
    threads: 'a | b | c',
    profileDigest: 'operator, stacked',
  };

  it('carries the transcript and every context field into the prompt', () => {
    const p = buildRouterPrompt('burn last night', ctx);
    expect(p).toContain('Steward said: "burn last night"');
    expect(p).toContain('- Active view: record');
    expect(p).toContain('- Fast: active');
    expect(p).toContain('- Report window: closed until 8:45pm');
    expect(p).toContain("- Tonight's entry filed: no");
    expect(p).toContain('- Recent record threads: a | b | c');
    expect(p).toContain('- Profile digest: operator, stacked');
  });

  it('offers the router every intent it is allowed to return', () => {
    const p = buildRouterPrompt('anything', ctx);
    for (const id of GOVERNOR_INTENTS) {
      expect(p, id).toContain(`- ${id}`);
    }
  });

  it('asks for the JSON shape parseIntent reads', () => {
    const p = buildRouterPrompt('anything', ctx);
    for (const key of ['intent', 'confidence', 'slots', 'speak_back', 'scripture_ref', 'needs_confirm']) {
      expect(p, key).toContain(`"${key}"`);
    }
  });
});
