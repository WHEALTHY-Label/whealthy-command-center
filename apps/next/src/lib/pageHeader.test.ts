import { describe, expect, it } from 'vitest';
import {
  AI_HEADER_VIEWS,
  PERSONAL_VIEWS,
  applyAiHeader,
  archetypeLabel,
  isAiHeaderView,
  pageHeader,
  stewardFirstName,
} from '@/lib/pageHeader';

describe('stewardFirstName', () => {
  it('takes the first token of a full name and capitalizes it', () => {
    expect(stewardFirstName('ignacio jacobs', 'ignacio@thebizcofirm.com')).toBe('Ignacio');
  });

  it('leaves an already capitalized name alone', () => {
    expect(stewardFirstName('Ignacio Jacobs', null)).toBe('Ignacio');
  });

  it('falls back to the email local part when there is no name', () => {
    expect(stewardFirstName(null, 'ignacio@thebizcofirm.com')).toBe('Ignacio');
    expect(stewardFirstName('   ', 'qa-steward-1@whealthylabel.com')).toBe('Qa-steward-1');
  });

  it('falls back to Steward when there is neither', () => {
    expect(stewardFirstName(null, null)).toBe('Steward');
    expect(stewardFirstName('', '')).toBe('Steward');
    expect(stewardFirstName(null, '@example.com')).toBe('Steward');
  });

  it('collapses runs of whitespace the way split(/\\s+/) does', () => {
    expect(stewardFirstName('  ignacio   tayler ', null)).toBe('Ignacio');
  });
});

describe('archetypeLabel', () => {
  it('title-cases and de-slugs', () => {
    expect(archetypeLabel('steady_builder')).toBe('Steady Builder');
    expect(archetypeLabel('night-owl')).toBe('Night Owl');
    expect(archetypeLabel('Steady Builder')).toBe('Steady Builder');
  });

  it('returns empty for nothing, so the clause is dropped rather than blank', () => {
    expect(archetypeLabel(null)).toBe('');
    expect(archetypeLabel('')).toBe('');
    expect(archetypeLabel('   ')).toBe('');
    expect(archetypeLabel('__')).toBe('');
  });
});

describe('pageHeader', () => {
  it('names the steward on every view', () => {
    for (const view of PERSONAL_VIEWS) {
      const h = pageHeader(view, 'Ignacio', '');
      expect(h.title.startsWith("Ignacio's ")).toBe(true);
      expect(h.sub.length).toBeGreaterThan(0);
    }
  });

  it('matches the legacy copy verbatim', () => {
    expect(pageHeader('record', 'Ignacio', '')).toEqual({
      title: "Ignacio's Daily Scribe",
      sub: 'Write your thoughts, log your rules, and keep the standard.',
    });
    expect(pageHeader('fast', 'Ignacio', '')).toEqual({
      title: "Ignacio's Fast Protocol",
      sub: 'Track your fasting days, daily directives, and physical sync status.',
    });
    expect(pageHeader('portal', 'Ignacio', '')).toEqual({
      title: "Ignacio's Product Portal",
      sub: 'Manage subscriptions, update payment methods, and edit delivery cycles.',
    });
    expect(pageHeader('affiliate', 'Ignacio', '')).toEqual({
      title: "Ignacio's Affiliate Command",
      sub: 'Spread your stewardship. Share invite links and unlock free months.',
    });
    expect(pageHeader('community', 'Ignacio', '')).toEqual({
      title: "Ignacio's Steward Circle",
      sub: 'Discuss routines, share insights, and connect with fellow creators.',
    });
  });

  it('adds the archetype clause to the claim subtitle only when known', () => {
    expect(pageHeader('claim', 'Ignacio', 'Steady Builder').sub).toBe(
      'Your personal blend is ready. Matched to archetype: Steady Builder.',
    );
    expect(pageHeader('claim', 'Ignacio', '').sub).toBe('Your personal blend is ready.');
    expect(pageHeader('claim', 'Ignacio', '   ').sub).toBe('Your personal blend is ready.');
  });

  it('never renders an empty name', () => {
    expect(pageHeader('portal', '', '').title).toBe("Steward's Product Portal");
  });
});

describe('isAiHeaderView', () => {
  it('is true for exactly the views synthesis returns header copy for', () => {
    for (const view of PERSONAL_VIEWS) {
      expect(isAiHeaderView(view)).toBe((AI_HEADER_VIEWS as readonly string[]).includes(view));
    }
  });
});

describe('applyAiHeader', () => {
  const base = { title: "Ignacio's Daily Scribe", sub: 'Keep the standard.' };

  it('overrides field by field, as the legacy aiMap did', () => {
    expect(applyAiHeader(base, 'Steward&rsquo;s Journal', null)).toEqual({
      title: 'Steward&rsquo;s Journal',
      sub: 'Keep the standard.',
    });
    expect(applyAiHeader(base, null, 'Two entries in. Keep going.')).toEqual({
      title: "Ignacio's Daily Scribe",
      sub: 'Two entries in. Keep going.',
    });
  });

  it('keeps the deterministic header when the model said nothing', () => {
    expect(applyAiHeader(base, null, null)).toEqual(base);
    expect(applyAiHeader(base, '', '   ')).toEqual(base);
  });

  it('trims what it takes', () => {
    expect(applyAiHeader(base, '  Journal  ', ' one line ')).toEqual({
      title: 'Journal',
      sub: 'one line',
    });
  });
});
