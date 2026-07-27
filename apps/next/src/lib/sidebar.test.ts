import { describe, expect, it } from 'vitest';
import {
  SIDEBAR_SECTIONS,
  avatarInitial,
  dayBadgeLabel,
  safeAvatarUrl,
  sidebarDisplayName,
} from './sidebar';

describe('SIDEBAR_SECTIONS', () => {
  it('carries the live app three sections in order', () => {
    expect(SIDEBAR_SECTIONS.map((s) => s.title)).toEqual(['General', 'Disciplines', 'More']);
  });

  it('labels the journal the way the live app did', () => {
    const general = SIDEBAR_SECTIONS[0]!;
    const record = general.items.find((i) => i.href === '/record');
    expect(record?.label).toBe('My Journal');
  });

  it('keeps Community in General with both destinations', () => {
    const general = SIDEBAR_SECTIONS[0]!;
    const community = general.items.find((i) => i.label === 'Community');
    expect(community?.children?.map((c) => c.href)).toEqual(['/community', '/community/enter']);
  });

  it('hangs each badge on the row that owned it', () => {
    const badged = SIDEBAR_SECTIONS.flatMap((s) =>
      s.items.flatMap((i) => [
        ...(i.badge ? [[i.href, i.badge] as const] : []),
        ...(i.children ?? []).flatMap((c) => (c.badge ? [[c.href, c.badge] as const] : [])),
      ]),
    );
    expect(badged).toEqual([
      ['/claim', 'claim'],
      ['/me', 'unseenPrayers'],
      ['/fast', 'fastDay'],
    ]);
  });

  it('never lists a destination twice at the same level', () => {
    for (const section of SIDEBAR_SECTIONS) {
      const tops = section.items.map((i) => i.href);
      expect(new Set(tops).size).toBe(tops.length);
    }
  });
});

describe('sidebarDisplayName', () => {
  it('prefers the stored name', () => {
    expect(sidebarDisplayName('Ignacio Ramirez', 'ignacio@x.com')).toBe('Ignacio Ramirez');
  });

  it('treats the "Steward" placeholder as no name', () => {
    expect(sidebarDisplayName('Steward', 'ignacio@x.com')).toBe('Ignacio');
  });

  it('opens up separators in the email local part', () => {
    expect(sidebarDisplayName(null, 'jake.tayler_jacobs@x.com')).toBe('Jake Tayler Jacobs');
    expect(sidebarDisplayName('', 'mary-anne@x.com')).toBe('Mary Anne');
  });

  it('falls back when there is nothing at all', () => {
    expect(sidebarDisplayName(null, null)).toBe('Steward');
    expect(sidebarDisplayName(null, '@x.com')).toBe('Steward');
  });
});

describe('avatarInitial', () => {
  it('takes one uppercase letter', () => {
    expect(avatarInitial('ignacio')).toBe('I');
    expect(avatarInitial('Mary Anne')).toBe('M');
  });

  it('falls back rather than rendering an empty circle', () => {
    expect(avatarInitial('   ')).toBe('S');
  });
});

describe('dayBadgeLabel', () => {
  it('prints the day of an active fast', () => {
    expect(dayBadgeLabel(1)).toBe('DAY 1');
    expect(dayBadgeLabel(21)).toBe('DAY 21');
  });

  it('stays hidden when no fast is running', () => {
    expect(dayBadgeLabel(null)).toBeNull();
    expect(dayBadgeLabel(0)).toBeNull();
    expect(dayBadgeLabel(Number.NaN)).toBeNull();
  });
});

describe('safeAvatarUrl', () => {
  it('accepts skool.com over https', () => {
    expect(safeAvatarUrl('https://assets.skool.com/a.jpg')).toBe('https://assets.skool.com/a.jpg');
    expect(safeAvatarUrl('https://skool.com/a.jpg')).toBe('https://skool.com/a.jpg');
  });

  it('refuses anything else', () => {
    expect(safeAvatarUrl('http://assets.skool.com/a.jpg')).toBeNull();
    expect(safeAvatarUrl('https://evil.com/a.jpg')).toBeNull();
    expect(safeAvatarUrl('https://notskool.com/a.jpg')).toBeNull();
    expect(safeAvatarUrl('javascript:alert(1)')).toBeNull();
    expect(safeAvatarUrl('not a url')).toBeNull();
    expect(safeAvatarUrl(null)).toBeNull();
    expect(safeAvatarUrl('')).toBeNull();
  });
});
