'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { WallPost } from '@/lib/wall';
import { amenPost, fetchWallView, reportPost } from '@/lib/actions/wall';
import { WallCard } from '@/components/wall/WallCard';
import ui from '@/components/ui.module.css';
import styles from './testimony.module.css';

const PAGE = 12;

export function TestimonyClient({
  top,
  initialRiver,
  riverError,
  pinned,
  pinnedError,
}: {
  top: WallPost[];
  initialRiver: WallPost[];
  /**
   * Why the river is empty when it is empty for a bad reason. "The first answer
   * will be here." is a promise, and printing it over a failed read tells a
   * steward the community has never had a prayer answered.
   */
  riverError: string | null;
  pinned: WallPost | null;
  /** Why a shared link is not showing its testimony. Null for a plain 404. */
  pinnedError: string | null;
}) {
  const [topPosts, setTopPosts] = useState(top);
  const [river, setRiver] = useState(initialRiver);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(initialRiver.length < PAGE);
  const [loadError, setLoadError] = useState<string | null>(riverError);
  const [pinnedPost, setPinnedPost] = useState(pinned);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reportArmed, setReportArmed] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const patchEverywhere = (id: string, patch: Partial<WallPost>) => {
    const apply = (list: WallPost[]) => list.map((p) => (p.id === id ? { ...p, ...patch } : p));
    setTopPosts(apply);
    setRiver(apply);
    setPinnedPost((p) => (p && p.id === id ? { ...p, ...patch } : p));
  };

  const amen = (post: WallPost) => {
    if (post.hasAmened) return;
    patchEverywhere(post.id, { amenCount: post.amenCount + 1, hasAmened: true });
    startTransition(async () => {
      const result = await amenPost(post.id);
      if (!result.ok) {
        patchEverywhere(post.id, { amenCount: post.amenCount, hasAmened: false });
        return;
      }
      patchEverywhere(post.id, {
        ...(result.amenCount !== undefined ? { amenCount: result.amenCount } : {}),
        hasAmened: result.hasAmened ?? true,
      });
    });
  };

  const copyLink = async (post: WallPost) => {
    const url = `${window.location.origin}/testimony?post=${encodeURIComponent(post.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(post.id);
      setTimeout(() => setCopiedId((c) => (c === post.id ? null : c)), 2000);
    } catch {
      // The link is visible in the address bar pattern either way.
    }
  };

  const report = (post: WallPost) => {
    if (reportArmed !== post.id) {
      setReportArmed(post.id);
      setTimeout(() => setReportArmed((r) => (r === post.id ? null : r)), 4000);
      return;
    }
    setReportArmed(null);
    startTransition(async () => {
      const result = await reportPost(post.id, 'Flagged by community');
      if (result.ok) setReported((s) => new Set(s).add(post.id));
    });
  };

  const footerFor = (post: WallPost) => (
    <>
      <button
        type="button"
        className={post.hasAmened ? ui.chipActive : ui.chip}
        onClick={() => amen(post)}
      >
        {post.hasAmened ? '✓ ' : ''}Amen · {post.amenCount}
      </button>
      <button type="button" className={ui.quiet} onClick={() => void copyLink(post)}>
        {copiedId === post.id ? 'Link copied.' : 'Share'}
      </button>
      {reported.has(post.id) ? (
        <span className={ui.sub}>Reported.</span>
      ) : (
        <button type="button" className={ui.quiet} onClick={() => report(post)}>
          {reportArmed === post.id ? 'Report?' : 'Flag'}
        </button>
      )}
    </>
  );

  const loadMore = () => {
    startTransition(async () => {
      const result = await fetchWallView('testimony_river', (page + 1) * PAGE, PAGE);
      if (!result.ok) {
        setLoadError(result.error ?? 'Could not load more. Please retry.');
        return;
      }
      setLoadError(null);
      setRiver((r) => [...r, ...result.posts.filter((p) => !r.some((q) => q.id === p.id))]);
      setPage((p) => p + 1);
      if (result.posts.length < PAGE) setDone(true);
    });
  };

  return (
    <>
      {pinnedError ? <p className={ui.error}>{pinnedError}</p> : null}
      {pinnedPost ? (
        <section className={styles.pinned}>
          <div className={ui.row}>
            <p className={ui.kicker}>Shared with you</p>
            <button
              type="button"
              className={styles.dismiss}
              aria-label="Dismiss"
              onClick={() => setPinnedPost(null)}
            >
              &times;
            </button>
          </div>
          {pinnedPost.status === 'answered' ? (
            <WallCard post={pinnedPost} showTrack>
              {footerFor(pinnedPost)}
            </WallCard>
          ) : (
            <p className={ui.body}>
              This prayer has not been answered yet.{' '}
              <Link href={`/wall?post=${pinnedPost.id}`} className={ui.link}>
                Go to Prayer Wall
              </Link>
            </p>
          )}
        </section>
      ) : null}

      {topPosts.length > 0 ? (
        <section>
          <h2 className={styles.sectionTitle}>Most Carried</h2>
          <p className={ui.sub}>The answers the community carried hardest.</p>
          <div className={styles.topGrid}>
            {topPosts.map((post) => (
              <WallCard key={post.id} post={post} showTrack>
                {footerFor(post)}
              </WallCard>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.river}>
        <h2 className={styles.sectionTitle}>Every Answer</h2>
        <p className={ui.sub}>Newest first. Nothing ever leaves.</p>
        {loadError ? <p className={ui.error}>{loadError}</p> : null}
        {river.length === 0 && !loadError ? (
          <p className={ui.sub}>The first answer will be here.</p>
        ) : (
          river.map((post) => (
            <WallCard key={post.id} post={post} showTrack>
              {footerFor(post)}
            </WallCard>
          ))
        )}
        {!done ? (
          <button type="button" className={ui.quiet} disabled={pending} onClick={loadMore}>
            Show more
          </button>
        ) : null}
      </section>
    </>
  );
}
