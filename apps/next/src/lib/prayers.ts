/**
 * Hand It Over: categories, led prayers, and ledger parsing against the
 * deployed `prayers-read` default view, which answers a PLAIN ARRAY of
 * {id, body, category, created_at, status, pray_count, outcome, closed_on}
 * where status is computed server-side: 'answered' | 'lifted' | 'private'.
 */

export type LedgerStatus = 'answered' | 'lifted' | 'private';

export interface LedgerItem {
  id: string;
  body: string;
  category: string;
  createdAt: string | null;
  status: LedgerStatus;
  prayCount: number;
  outcome: string | null;
  closedOn: string | null;
}

export function parseLedger(data: unknown): LedgerItem[] {
  // The function answers a bare array; older clients also accepted .handovers.
  const list = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && Array.isArray((data as Record<string, unknown>).handovers)
      ? ((data as Record<string, unknown>).handovers as unknown[])
      : [];
  return list
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .filter((r) => r.id !== undefined && r.id !== null)
    .map((r) => ({
      id: String(r.id),
      body: typeof r.body === 'string' ? r.body : '',
      category: typeof r.category === 'string' ? r.category : 'freeform',
      createdAt: typeof r.created_at === 'string' ? r.created_at : null,
      status:
        r.status === 'answered' || r.status === 'lifted' ? (r.status as LedgerStatus) : 'private',
      prayCount: typeof r.pray_count === 'number' ? r.pray_count : 0,
      outcome: typeof r.outcome === 'string' ? r.outcome : null,
      closedOn: typeof r.closed_on === 'string' ? r.closed_on : null,
    }));
}

export interface HioCategory {
  key: string;
  label: string;
  icon: string;
  led: string;
  scriptureRef: string;
  scriptureText: string;
}

/**
 * The six doors and their led prayers, byte-faithful to the live app's
 * hardcoded map (index.html 11318-11335 region).
 */
export const HIO_CATEGORIES: HioCategory[] = [
  {
    key: 'family',
    label: 'Family',
    icon: '👥',
    led: "Father, this house is Yours before it's mine. I hand You the people under this roof and the weight I carry for them.",
    scriptureRef: 'Psalm 127:1',
    scriptureText:
      'Unless the LORD builds the house, its builders labor in vain. Unless the LORD protects the city, its watchmen stand guard in vain.',
  },
  {
    key: 'work',
    label: 'Work',
    icon: '💼',
    led: 'The work is real and the weight is real. I hand You the outcomes I cannot control and keep the hands You gave me on the plow.',
    scriptureRef: 'Psalm 90:17',
    scriptureText:
      'May the favor of the Lord our God rest upon us; establish for us the work of our hands, yes, establish the work of our hands.',
  },
  {
    key: 'money',
    label: 'Money',
    icon: '💵',
    led: 'You know what this month costs before I count it. I hand You the numbers and keep my eyes on Your kingdom first.',
    scriptureRef: 'Matthew 6:33',
    scriptureText:
      'But seek first the kingdom of God and His righteousness, and all these things will be added unto you.',
  },
  {
    key: 'health',
    label: 'Health',
    icon: '❤️',
    led: 'This body is the house You gave me to govern. I hand You what is failing in it and trust You with what I cannot mend.',
    scriptureRef: 'Psalm 73:26',
    scriptureText:
      'My flesh and my heart may fail, but God is the strength of my heart and my portion forever.',
  },
  {
    key: 'head',
    label: 'My Own Head',
    icon: '🧠',
    led: 'My mind has been running the same lap all day. I hand You the loop and take Your steadiness in its place.',
    scriptureRef: 'Isaiah 26:3',
    scriptureText:
      'You will keep in perfect peace the steadfast of mind, because he trusts in You.',
  },
  {
    key: 'freeform',
    label: 'Say it your way...',
    icon: '💬',
    led: 'Father, I hand You the thoughts in my heart today. You know their shape better than I can say it.',
    scriptureRef: 'Matthew 11:28',
    scriptureText:
      'Come to Me, all you who are weary and burdened, and I will give you rest.',
  },
];

export function hioCategory(key: string): HioCategory {
  return HIO_CATEGORIES.find((c) => c.key === key) ?? HIO_CATEGORIES[HIO_CATEGORIES.length - 1]!;
}
