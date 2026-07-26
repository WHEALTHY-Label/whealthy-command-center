/**
 * Product catalog data carried over from the live app (CC_BUNDLES,
 * try-page SKUs, affiliate targets). Prices are the shipped July 2026
 * numbers; the member price is 10% off the try price and the fallback
 * discount code WHSBGN is replaced by the member's real code at runtime.
 */

export interface Bundle {
  key: string;
  name: string;
  tag: string;
  tagline: string;
  url: string;
  tryPrice: number;
  retail: number;
  member: number;
}

export const SHIPPING_FLAT = 9.95;
export const FALLBACK_CODE = 'WHSBGN';

export const CC_BUNDLES: Bundle[] = [
  {
    key: 'genius-joe',
    name: 'Genius Joe + Hydration',
    tag: 'Functional mushroom coffee · Morning',
    tagline: 'Your Governed Morning Bundle',
    url: 'https://whealthylabel.com/genius-joe-functional-coffee-hydration-bundle',
    tryPrice: 64.0,
    retail: 84.98,
    member: 57.6,
  },
  {
    key: 'boss',
    name: 'Boss + Hydration',
    tag: '10X nootropic capsules · Midday',
    tagline: 'Your Governed Performance Bundle',
    url: 'https://whealthylabel.com/boss-performance-capsules-hydration-bundle',
    tryPrice: 55.0,
    retail: 84.98,
    member: 49.5,
  },
  {
    key: 'genius-guice',
    name: 'Genius Guice + Hydration',
    tag: 'Nootropic think drink · Afternoon',
    tagline: 'Your Governed Clarity Bundle',
    url: 'https://whealthylabel.com/genius-guice-think-drink-powder-hydration-bundle',
    tryPrice: 60.0,
    retail: 84.98,
    member: 54.0,
  },
  {
    key: 'charge',
    name: 'Charge + Hydration',
    tag: 'Clean energy powder · Afternoon',
    tagline: 'Your Governed Energy Bundle',
    url: 'https://whealthylabel.com/charge-powder-hydration',
    tryPrice: 60.0,
    retail: 84.98,
    member: 54.0,
  },
];

export function bundleByKey(key: string | null | undefined): Bundle {
  return CC_BUNDLES.find((b) => b.key === key) ?? CC_BUNDLES[3]!;
}

export interface TryProduct {
  id: string;
  title: string;
  tagline: string | null;
  price: number;
  retail: number;
  url: string;
  blurb: string;
}

export const TRY_PRODUCTS: TryProduct[] = [
  {
    id: 'hydration',
    title: 'WHEALTHY Water (Lemonade Flavor)',
    tagline: null,
    price: 20,
    retail: 34.99,
    url: 'https://whealthylabel.com/new/try-hydration-powder',
    blurb: 'Daily foundation. Electrolytes and steady hydration without the sugar crash.',
  },
  {
    id: 'charge',
    title: 'Charge Powder',
    tagline: 'Crush The Can',
    price: 40,
    retail: 49.99,
    url: 'https://whealthylabel.com/new/try-charge-powder',
    blurb: 'Clean energy for the afternoon dip, built to replace the can.',
  },
  {
    id: 'genius-guice',
    title: 'Genius Guice',
    tagline: 'Freedom To Think',
    price: 40,
    retail: 49.99,
    url: 'https://whealthylabel.com/new/try-genius-guice-powder',
    blurb: 'A nootropic think drink for the deep-work block.',
  },
  {
    id: 'genius-joe',
    title: 'Genius Joe Coffee',
    tagline: null,
    price: 44,
    retail: 49.99,
    url: 'https://whealthylabel.com/new/try-gj-coffee',
    blurb: 'Functional mushroom coffee that starts the morning without owning it.',
  },
  {
    id: 'boss',
    title: 'Boss Capsules',
    tagline: null,
    price: 35,
    retail: 49.99,
    url: 'https://whealthylabel.com/new/try-boss-capsules-sp',
    blurb: '10X nootropic capsules for the midday push.',
  },
];

export interface AffiliateTarget {
  name: string;
  path: string;
  pitch: string;
}

export const AFFILIATE_TARGETS: AffiliateTarget[] = [
  { name: 'The Main Invite 🔥', path: '/invite', pitch: 'The front door. Send this one first.' },
  { name: 'Steward Quiz', path: '/steward-quiz', pitch: 'The energy assessment that matches a routine.' },
  { name: 'Try All Bundle', path: '/try-all', pitch: 'Every routine in the house, open to try.' },
  { name: 'Genius Joe Coffee', path: '/try-gj-coffee', pitch: 'Functional mushroom coffee.' },
  { name: 'Boss Capsules', path: '/try-boss-capsules-sp', pitch: '10X nootropic capsules.' },
  { name: 'Charge Powder', path: '/try-charge-powder', pitch: 'Clean energy powder.' },
  { name: 'Genius Guice', path: '/try-genius-guice-powder', pitch: 'The nootropic think drink.' },
  { name: 'Hydration Powder', path: '/try-hydration-powder', pitch: 'The daily foundation.' },
  { name: 'About Us', path: '/about-us', pitch: 'The WHEALTHY story.' },
  { name: 'Homepage', path: '/', pitch: 'The label itself.' },
];

export function affiliateUrl(path: string, refId: string): string {
  return `https://whealthylabel.com${path === '/' ? '' : path}?ref=${encodeURIComponent(refId)}`;
}

/**
 * Pull the ref id out of a pasted Skool invite link, matching the live
 * app's tolerance: a ?ref= param, a ref=token fragment, or a bare token.
 */
export function extractRefId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const ref = url.searchParams.get('ref');
    if (ref) return ref;
  } catch {
    // not a URL; keep going
  }
  const m = trimmed.match(/ref=([a-zA-Z0-9_-]+)/);
  if (m) return m[1] ?? null;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed) ? trimmed : null;
}

export const SKOOL_URL = 'https://www.skool.com/bakndcreator';
export const BILLING_PORTAL_URL = 'https://whealthylabel.com/member';
