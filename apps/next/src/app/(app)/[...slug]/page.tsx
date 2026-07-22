import { ComingSoon } from '@/components/ComingSoon';

// Friendly titles for the not-yet-migrated routes reachable from the sidebar.
const TITLES: Record<string, string> = {
  claim: 'Claim Bundle',
  tryall: 'Try All',
  record: 'The Record',
  prayer: 'Prayer',
  wall: 'Prayer Wall',
  testimony: 'Testimony Wall',
  me: 'My Prayers',
  bible: 'Scripture',
  fast: 'Fasting',
  cohort: 'Cohort Challenge',
  circle: 'Circles',
  community: 'Community',
  affiliate: 'Affiliate Center',
  portal: 'Product Portal',
  admin: 'Control Center',
};

function titleFor(slug: string[]): string {
  const first = slug[0] ?? '';
  if (TITLES[first]) return TITLES[first];
  return first
    .split('-')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export default async function ComingSoonRoute({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <ComingSoon title={titleFor(slug)} />;
}
