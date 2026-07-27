import { ComingSoon } from '@/components/ComingSoon';

/**
 * The catch-all under the protected shell.
 *
 * This used to hold a title map for the sidebar rooms that had not been
 * migrated yet. Every one of them is a real route now, so the map is gone and
 * only the humanising fallback remains: this page is reached solely by a URL
 * that matches nothing, typically an old deep link.
 */
function titleFor(slug: string[]): string {
  return (slug[0] ?? '')
    .split('-')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export default async function ComingSoonRoute({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <ComingSoon title={titleFor(slug)} />;
}
