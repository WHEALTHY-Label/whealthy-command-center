import { fetchWallPost, fetchWallView } from '@/lib/actions/wall';
import { getAuthedEmail, getAvatarUrl } from '@/lib/auth/session';
import { fetchMemberProfile } from '@/lib/tour';
import { WallClient } from './WallClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function WallPage({
  searchParams,
}: {
  searchParams: Promise<{ post?: string }>;
}) {
  const { post } = await searchParams;
  const email = await getAuthedEmail();
  // `fetchWallPost('')` short-circuits to an empty result, so the no-deep-link
  // case and the deep-linked case have the same shape.
  //
  // The name and the face are for the signed-mode preview: the live app showed
  // the steward exactly what his prayer would carry before he posted it
  // (index.html:5745-5777), which is the last moment he can change his mind
  // about being named.
  const [needs, most, pinned, profile, avatarUrl] = await Promise.all([
    fetchWallView('needs_prayer', 0, 12),
    fetchWallView('most_prayed', 0, 12),
    fetchWallPost(post ?? ''),
    email ? fetchMemberProfile(email) : Promise.resolve(null),
    getAvatarUrl(),
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
        needsError={needs.error ?? null}
        initialMost={most.posts}
        mostError={most.error ?? null}
        pinned={pinned.post}
        pinnedError={pinned.error}
        pinnedRequested={Boolean(post)}
        memberName={profile?.name ?? 'A Steward'}
        memberAvatar={avatarUrl}
      />
    </div>
  );
}
