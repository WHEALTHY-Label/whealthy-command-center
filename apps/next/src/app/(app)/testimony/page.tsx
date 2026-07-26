import { fetchWallPost, fetchWallView } from '@/lib/actions/wall';
import { TestimonyClient } from './TestimonyClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function TestimonyPage({
  searchParams,
}: {
  searchParams: Promise<{ post?: string }>;
}) {
  const { post } = await searchParams;
  const [top, river, pinned] = await Promise.all([
    fetchWallView('testimony_top', 0, 11),
    fetchWallView('testimony_river', 0, 12),
    post ? fetchWallPost(post) : Promise.resolve(null),
  ]);

  return (
    <div className={ui.pageWide}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Testimony Wall</p>
        <h1 className={ui.title}>What He did</h1>
        <p className={ui.sub}>Every answered prayer, kept.</p>
      </header>
      <TestimonyClient top={top.posts} initialRiver={river.posts} pinned={pinned} />
    </div>
  );
}
