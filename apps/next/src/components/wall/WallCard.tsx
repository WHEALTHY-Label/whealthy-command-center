'use client';

import { useEffect, useState } from 'react';
/* eslint-disable @next/next/no-img-element -- Skool avatars come from an
   external CDN; next/image would need remote-pattern config for marginal
   gain on a 32px avatar. */
import type { WallPost } from '@/lib/wall';
import { relativeTime, testimonyTrack } from '@/lib/wall';
import styles from './wallcard.module.css';

/**
 * Shared card shell for wall, testimony, and my-prayers screens. The body
 * and answered blocks are common; each screen supplies its own footer
 * (pray, amen, answer/sign, ...) as children.
 */
export function WallCard({
  post,
  showTrack = false,
  highlight = false,
  children,
}: {
  post: WallPost;
  showTrack?: boolean;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  // Relative timestamps drift; render them client-side after mount so the
  // server HTML never disagrees with the hydrated tree. The zero-delay timer
  // keeps the clock read out of the effect body itself.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(id);
  }, []);

  const signed = post.displayMode === 'signed';
  const answered = post.status === 'answered';

  return (
    <article
      className={`${post.status === 'held' ? styles.cardHeld : styles.card} ${highlight ? styles.unseen : ''}`}
    >
      <div className={styles.head}>
        {signed && post.authorAvatar ? (
          <img src={post.authorAvatar} alt="" className={styles.avatar} />
        ) : (
          <span className={styles.avatarAnon} aria-hidden="true">
            {signed ? (post.authorName[0] ?? 'S') : '☉'}
          </span>
        )}
        <span className={styles.name}>{signed ? post.authorName : 'A Steward'}</span>
        <span className={styles.time}>{now === null ? '' : relativeTime(post.createdAt, now)}</span>
      </div>

      {post.status === 'held' ? (
        <p className={styles.body}>This prayer is under review.</p>
      ) : answered ? (
        <>
          <div>
            <p className={styles.blockLabel}>Asked</p>
            <p className={styles.body}>{post.body}</p>
          </div>
          <div className={styles.answered}>
            <p className={styles.answeredLabel}>Answered</p>
            <p className={styles.body}>
              {post.answeredNote ?? 'Marked answered without a note.'}
            </p>
          </div>
          {showTrack ? (
            <p className={styles.track}>
              {testimonyTrack(post.createdAt, post.answeredAt)}
              {post.prayCount > 0 ? ` · Prayed ${post.prayCount} times` : ''}
            </p>
          ) : null}
        </>
      ) : (
        <p className={styles.body}>{post.body}</p>
      )}

      {children ? <div className={styles.footer}>{children}</div> : null}
    </article>
  );
}
