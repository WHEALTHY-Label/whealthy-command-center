'use client';

import { useEffect, useRef, useState } from 'react';
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
  pulse = false,
  dimmed = false,
  innerRef,
  children,
}: {
  post: WallPost;
  showTrack?: boolean;
  highlight?: boolean;
  /** The 1.5s border glow the live app threw on a new or shared card. */
  pulse?: boolean;
  /** Reported cards drop to 0.6 opacity, as `submitReport` did (5606-5607). */
  dimmed?: boolean;
  /**
   * A handle on the card element itself, for screens that need to know when a
   * card is genuinely on screen. Passed straight through rather than wrapping
   * the card in another box, so the list layout is untouched.
   */
  innerRef?: React.Ref<HTMLElement>;
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

  // `initReadMore` at index.html:5428 measured the clamped paragraph after it
  // was in the document and only revealed the fade and the button when the
  // text genuinely overflowed six lines. Same measurement here, deferred by a
  // zero-delay timer so the state write is not in the effect body.
  //
  // "Read more" is remembered per body rather than in a separate flag reset by
  // an effect, so a card that swaps to a different prayer re-clamps without a
  // state write during render or in an effect body.
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const expanded = expandedFor === post.body;
  useEffect(() => {
    const id = setTimeout(() => {
      const el = bodyRef.current;
      setOverflows(el ? el.scrollHeight > el.clientHeight + 1 : false);
    }, 0);
    return () => clearTimeout(id);
  }, [post.body]);

  const [photoBroken, setPhotoBroken] = useState(false);

  const signed = post.displayMode === 'signed';
  const answered = post.status === 'answered';
  const initial = (post.authorName[0] ?? 'S').toUpperCase();

  // The live app dropped the ANSWERED block entirely when the note was empty
  // (index.html:6258 guards the whole block on a non-blank note). The port had
  // invented "Marked answered without a note." and printed it into a prayer a
  // steward had deliberately left wordless.
  const note = post.answeredNote?.trim() ? post.answeredNote : null;

  const bodyBlock = (
    <div className={styles.bodyWrap}>
      <p ref={bodyRef} className={`${styles.body} ${expanded ? '' : styles.clamp}`}>
        {post.body}
      </p>
      {overflows && !expanded ? (
        <>
          <span className={styles.fade} aria-hidden="true" />
          <button
            type="button"
            className={styles.readMore}
            onClick={() => setExpandedFor(post.body)}
          >
            Read more
          </button>
        </>
      ) : null}
    </div>
  );

  const shellClass =
    post.status === 'held'
      ? styles.cardHeld
      : post.status === 'archived'
        ? styles.cardArchived
        : styles.card;

  return (
    <article
      ref={innerRef}
      className={`${shellClass} ${highlight ? styles.unseen : ''} ${pulse ? styles.pulse : ''} ${dimmed ? styles.dimmed : ''}`}
    >
      <div className={styles.head}>
        {signed && post.authorAvatar && !photoBroken ? (
          <img
            src={post.authorAvatar}
            alt=""
            className={styles.avatar}
            referrerPolicy="no-referrer"
            onError={() => setPhotoBroken(true)}
          />
        ) : (
          <span className={styles.avatarAnon} aria-hidden="true">
            {signed ? initial : '☉'}
          </span>
        )}
        <span className={styles.name}>{signed ? post.authorName : 'A Steward'}</span>
        <span className={styles.time}>{now === null ? '' : relativeTime(post.createdAt, now)}</span>
      </div>

      {post.status === 'held' ? (
        <>
          {/* The live app kept the steward's own words above the notice
              (index.html:7290-7291). A held prayer is still his; hiding the
              text told him nothing about which prayer was under review. */}
          {bodyBlock}
          <p className={styles.statusLine}>This prayer is under review.</p>
        </>
      ) : answered ? (
        <>
          <div>
            <p className={styles.blockLabel}>Asked</p>
            {bodyBlock}
          </div>
          {note ? (
            <div className={styles.answered}>
              <p className={styles.answeredLabel}>Answered</p>
              <p className={styles.body}>{note}</p>
            </div>
          ) : null}
          {showTrack ? (
            <p className={styles.track}>
              {testimonyTrack(post.createdAt, post.answeredAt)}
              {/* index.html:6304 printed the frozen count unconditionally,
                  including "Prayed 0 times". A testimony carried by nobody is
                  still a testimony, and the missing line looked like a bug. */}
              {` · Prayed ${post.prayCount} times`}
            </p>
          ) : null}
        </>
      ) : (
        <>
          {bodyBlock}
          {post.status === 'archived' ? (
            <p className={styles.statusLine}>This prayer left the wall.</p>
          ) : null}
        </>
      )}

      {children ? <div className={styles.footer}>{children}</div> : null}
    </article>
  );
}
