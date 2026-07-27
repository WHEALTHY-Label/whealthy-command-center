import { fetchWallView } from '@/lib/actions/wall';
import { MeClient } from './MeClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const [mine, watching] = await Promise.all([
    fetchWallView('my_prayers', 0, 24),
    fetchWallView('praying_for', 0, 24),
  ]);

  // The live app hides held posts from the watch list and floats unseen
  // answers to the top.
  const watchPosts = watching.posts
    .filter((p) => p.status !== 'held')
    .sort((a, b) => Number(b.hasUnseenAnswer) - Number(a.hasUnseenAnswer));

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>My Prayers</p>
        <h1 className={ui.title}>What you brought. What you carried.</h1>
        <p className={ui.sub}>Your prayers on the wall, and the ones you are praying for.</p>
      </header>
      <MeClient
        mine={mine.posts}
        mineError={mine.error ?? null}
        watching={watchPosts}
        watchingError={watching.error ?? null}
      />
    </div>
  );
}
