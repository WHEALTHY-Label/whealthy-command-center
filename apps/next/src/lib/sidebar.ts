/**
 * The sidebar's nav model and its four display helpers, kept pure so the
 * structure the live app shipped is pinned by tests rather than by eyeballing
 * the rendered rail.
 *
 * Every label, every grouping and every section title below is read off the
 * live app's markup at index.html:2085-2158. Where the port had drifted, the
 * live app wins: "The Record" was never a label a steward saw, the Community
 * group belongs in General beside Claim Bundle rather than exiled to the
 * bottom, and the third section is called "More".
 */

/** What a nav row is allowed to hang off its right edge. */
export type SidebarBadge = 'claim' | 'fastDay' | 'unseenPrayers';

export interface SidebarChild {
  label: string;
  href: string;
  badge?: SidebarBadge;
}

export interface SidebarItem {
  label: string;
  href: string;
  badge?: SidebarBadge;
  children?: SidebarChild[];
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    title: 'General',
    items: [
      { label: 'Home', href: '/' },
      { label: 'My Rhythm', href: '/rhythm' },
      // `#claimBadge` at index.html:2094: a lime pulse and the word "New",
      // shown only while the steward is unequipped.
      { label: 'Claim Bundle', href: '/claim', badge: 'claim' },
      { label: 'Try All', href: '/tryall' },
      { label: 'My Journal', href: '/record' },
      {
        label: 'Community',
        href: '/community',
        children: [
          { label: 'Post Wall', href: '/community' },
          { label: 'Enter Community', href: '/community/enter' },
        ],
      },
    ],
  },
  {
    title: 'Disciplines',
    items: [
      {
        label: 'Prayer',
        href: '/prayer',
        children: [
          { label: 'Prayer Wall', href: '/wall' },
          { label: 'Testimony Wall', href: '/testimony' },
          // `#meBadge` at index.html:2124: a 6px lime dot, lit when a prayer
          // the steward prayed for has been answered and not yet seen.
          { label: 'My Prayers', href: '/me', badge: 'unseenPrayers' },
        ],
      },
      { label: 'Scripture', href: '/bible' },
      {
        label: 'Fasting',
        href: '/fast',
        // `#navDayBadge` at index.html:2131, written by `updateNavBadge()`.
        badge: 'fastDay',
        children: [
          { label: 'The Fast', href: '/fast' },
          { label: 'Cohort Challenge', href: '/cohort' },
        ],
      },
      { label: 'Circles', href: '/circle' },
    ],
  },
  {
    title: 'More',
    items: [
      { label: 'Affiliate Center', href: '/affiliate' },
      { label: 'Product Portal', href: '/portal' },
    ],
  },
];

/**
 * The name the footer prints, reproducing index.html:18313 exactly:
 * the stored member name when there is one, otherwise the local part of the
 * email with separators opened up and every word capitalized.
 *
 * `verify-member` answers "Steward" when it has no name on the row, which is a
 * placeholder rather than a name, so it is treated as absent here the same way
 * `PersonalHeader` treats it.
 */
export function sidebarDisplayName(name: string | null, email: string | null): string {
  const trimmed = (name ?? '').trim();
  if (trimmed.length > 0 && trimmed !== 'Steward') return trimmed;
  const local = (email ?? '').split('@')[0] ?? '';
  const opened = local
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (opened.length === 0) return 'Steward';
  return opened.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One letter, the way `initials` is built at index.html:18314. */
export function avatarInitial(displayName: string): string {
  return (displayName.trim().charAt(0) || 'S').toUpperCase();
}

/** `DAY n` for the Fasting row, or null when no fast is running today. */
export function dayBadgeLabel(fastDay: number | null): string | null {
  if (typeof fastDay !== 'number' || !Number.isFinite(fastDay) || fastDay < 1) return null;
  return `DAY ${Math.floor(fastDay)}`;
}

/**
 * `waSafeAvatarUrl` at index.html:11999, reproduced field for field: an avatar
 * is only ever loaded over https from skool.com or one of its subdomains.
 *
 * The URL arrives on `user_metadata`, which the steward can edit, so it is
 * display input and nothing else. Nothing downstream reads identity from it.
 */
export function safeAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  if (host !== 'skool.com' && !host.endsWith('.skool.com')) return null;
  return url.toString();
}
