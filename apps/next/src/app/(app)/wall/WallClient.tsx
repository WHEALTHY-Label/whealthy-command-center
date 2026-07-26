'use client';

import { useState, useTransition } from 'react';
import type { WallPost } from '@/lib/wall';
import { fetchWallView, postToWall, prayForPost, reportPost, signPost } from '@/lib/actions/wall';
import { WallCard } from '@/components/wall/WallCard';
import ui from '@/components/ui.module.css';
import styles from './wall.module.css';

const PAGE = 12;

interface RailState {
  posts: WallPost[];
  page: number;
  done: boolean;
}

export function WallClient({
  initialNeeds,
  initialMost,
  pinned,
}: {
  initialNeeds: WallPost[];
  initialMost: WallPost[];
  pinned: WallPost | null;
}) {
  const [needs, setNeeds] = useState<RailState>({
    posts: initialNeeds,
    page: 0,
    done: initialNeeds.length < PAGE,
  });
  const [most, setMost] = useState<RailState>({
    posts: initialMost,
    page: 0,
    done: initialMost.length < PAGE,
  });
  const [pinnedPost, setPinnedPost] = useState(pinned);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<'anonymous' | 'signed'>('anonymous');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reportArmed, setReportArmed] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [signAsk, setSignAsk] = useState<WallPost | null>(null);
  const [pending, startTransition] = useTransition();

  const patchEverywhere = (id: string, patch: Partial<WallPost>) => {
    const apply = (rail: RailState): RailState => ({
      ...rail,
      posts: rail.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
    setNeeds(apply);
    setMost(apply);
    setPinnedPost((p) => (p && p.id === id ? { ...p, ...patch } : p));
  };

  const pray = (post: WallPost) => {
    if (post.praysRemainingToday <= 0) {
      setNotice('Prayed three times today. Again tomorrow.');
      setTimeout(() => setNotice(null), 3000);
      return;
    }
    // Optimistic bump, reconciled against the server's own count.
    patchEverywhere(post.id, {
      prayCount: post.prayCount + 1,
      praysRemainingToday: post.praysRemainingToday - 1,
    });
    startTransition(async () => {
      const result = await prayForPost(post.id);
      if (!result.ok) {
        patchEverywhere(post.id, {
          prayCount: post.prayCount,
          praysRemainingToday: result.error?.includes('three') ? 0 : post.praysRemainingToday,
        });
        setNotice(result.error ?? 'That did not save.');
        setTimeout(() => setNotice(null), 3000);
        return;
      }
      patchEverywhere(post.id, {
        ...(result.prayCount !== undefined ? { prayCount: result.prayCount } : {}),
        ...(result.praysRemaining !== undefined
          ? { praysRemainingToday: result.praysRemaining }
          : {}),
      });
    });
  };

  const copyLink = async (post: WallPost) => {
    const url = `${window.location.origin}/wall?post=${encodeURIComponent(post.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(post.id);
      setTimeout(() => setCopiedId((c) => (c === post.id ? null : c)), 2000);
    } catch {
      setNotice('Copy failed. The link is /wall?post=' + post.id);
    }
  };

  const share = (post: WallPost) => {
    // Sharing your own anonymous prayer can out you; the live app asks first.
    if (post.isMine && post.displayMode === 'anonymous') {
      setSignAsk(post);
      return;
    }
    void copyLink(post);
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

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await postToWall(draft, mode, 'wall');
      if (!result.ok) {
        setError(result.error ?? 'That did not save.');
        return;
      }
      if (result.post) {
        setNeeds((rail) => ({ ...rail, posts: [result.post!, ...rail.posts] }));
      }
      setDraft('');
      setComposerOpen(false);
    });
  };

  const loadMore = (view: 'needs_prayer' | 'most_prayed') => {
    const rail = view === 'needs_prayer' ? needs : most;
    const setRail = view === 'needs_prayer' ? setNeeds : setMost;
    startTransition(async () => {
      const result = await fetchWallView(view, (rail.page + 1) * PAGE, PAGE);
      if (!result.ok) return;
      setRail((r) => ({
        posts: [...r.posts, ...result.posts.filter((p) => !r.posts.some((q) => q.id === p.id))],
        page: r.page + 1,
        done: result.posts.length < PAGE,
      }));
    });
  };

  const footerFor = (post: WallPost) => (
    <>
      {!post.isMine && post.status === 'live' ? (
        <button
          type="button"
          className={post.praysRemainingToday > 0 ? ui.chip : ui.quiet}
          onClick={() => pray(post)}
        >
          🙏 Prayed {post.prayCount}
        </button>
      ) : (
        <span className={ui.sub}>🙏 {post.prayCount}</span>
      )}
      <button type="button" className={ui.quiet} onClick={() => share(post)}>
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

  return (
    <>
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
          <WallCard post={pinnedPost}>{footerFor(pinnedPost)}</WallCard>
        </section>
      ) : null}

      <section className={ui.card}>
        {composerOpen ? (
          <>
            <textarea
              className={ui.textarea}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1000}
              placeholder="What are you carrying?"
            />
            <p className={ui.sub}>{draft.length} / 1000</p>
            <div className={ui.row} role="radiogroup" aria-label="How to post">
              <label className={styles.modeChoice}>
                <input
                  type="radio"
                  name="wall-display-mode"
                  checked={mode === 'anonymous'}
                  onChange={() => setMode('anonymous')}
                />
                Anonymous
              </label>
              <label className={styles.modeChoice}>
                <input
                  type="radio"
                  name="wall-display-mode"
                  checked={mode === 'signed'}
                  onChange={() => setMode('signed')}
                />
                Sign it
              </label>
            </div>
            <p className={ui.sub}>
              {mode === 'anonymous'
                ? 'Your name will not appear. This posts as "A Steward."'
                : 'Your name and photo will appear on this prayer.'}
            </p>
            {error ? <p className={ui.error}>{error}</p> : null}
            <div className={ui.row}>
              <button
                type="button"
                className={ui.primary}
                disabled={pending || !draft.trim()}
                onClick={submit}
              >
                Post
              </button>
              <button
                type="button"
                className={ui.quiet}
                onClick={() => {
                  setComposerOpen(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button type="button" className={styles.composerCta} onClick={() => setComposerOpen(true)}>
            Bring something to the wall.
          </button>
        )}
      </section>

      {notice ? <p className={ui.error}>{notice}</p> : null}

      <div className={styles.rails}>
        <section className={styles.rail}>
          <h2 className={styles.railTitle}>Needs Prayer</h2>
          <p className={ui.sub}>Nobody prays alone.</p>
          {needs.posts.length === 0 ? (
            <p className={ui.sub}>Every prayer on the wall is being carried.</p>
          ) : (
            needs.posts.map((post) => (
              <WallCard key={post.id} post={post}>
                {footerFor(post)}
              </WallCard>
            ))
          )}
          {!needs.done ? (
            <button
              type="button"
              className={ui.quiet}
              disabled={pending}
              onClick={() => loadMore('needs_prayer')}
            >
              Show more
            </button>
          ) : null}
        </section>

        <section className={styles.rail}>
          <h2 className={styles.railTitle}>Most Prayed</h2>
          <p className={ui.sub}>What the community is carrying right now.</p>
          {most.posts.length === 0 ? (
            <p className={ui.sub}>Nothing has been prayed for yet.</p>
          ) : (
            most.posts.map((post) => (
              <WallCard key={post.id} post={post}>
                {footerFor(post)}
              </WallCard>
            ))
          )}
          {!most.done ? (
            <button
              type="button"
              className={ui.quiet}
              disabled={pending}
              onClick={() => loadMore('most_prayed')}
            >
              Show more
            </button>
          ) : null}
        </section>
      </div>

      {signAsk ? (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Sign this prayer">
          <div className={styles.modalCard}>
            <p className={styles.modalTitle}>This prayer is not signed</p>
            <p className={ui.body}>If you share it yourself, people may connect it to you.</p>
            <p className={ui.body}>
              If you want it seen without that, someone else can share it. Anyone on the wall can.
            </p>
            <button
              type="button"
              className={ui.primary}
              disabled={pending}
              onClick={() => {
                const post = signAsk;
                setSignAsk(null);
                startTransition(async () => {
                  const result = await signPost(post.id);
                  if (result.ok && result.post) {
                    patchEverywhere(post.id, {
                      displayMode: 'signed',
                      authorName: result.post.authorName,
                      authorAvatar: result.post.authorAvatar,
                    });
                  }
                  await copyLink(post);
                });
              }}
            >
              Sign it and share
            </button>
            <p className={ui.sub}>This cannot be undone.</p>
            <div className={ui.row}>
              <button
                type="button"
                className={ui.quiet}
                onClick={() => {
                  const post = signAsk;
                  setSignAsk(null);
                  void copyLink(post);
                }}
              >
                Share anyway
              </button>
              <button type="button" className={ui.quiet} onClick={() => setSignAsk(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
