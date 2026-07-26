import { fetchWallPost, fetchWallView } from '@/lib/actions/wall';
import { WallClient } from './WallClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function WallPage({
  searchParams,
}: {
  searchParams: Promise<{ post?: string }>;
}) {
  const { post } = await searchParams;
  const [needs, most, pinned] = await Promise.all([
    fetchWallView('needs_prayer', 0, 12),
    fetchWallView('most_prayed', 0, 12),
    post ? fetchWallPost(post) : Promise.resolve(null),
  ]);

  return (
    <div className={ui.pageWide}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Prayer Wall</p>
        <h1 className={ui.title}>What we are carrying</h1>
        <p className={ui.sub}>Bring it to the wall, and carry what others bring.</p>
      </header>
      <WallClient
        initialNeeds={needs.posts}
        initialMost={most.posts}
        pinned={pinned}
      />
    </div>
  );
}
