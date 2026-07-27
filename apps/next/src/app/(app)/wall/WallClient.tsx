'use client';

/* eslint-disable @next/next/no-img-element -- the signed-mode preview shows
   the steward's own Skool CDN photo at 32px; next/image would need a
   remotePatterns entry for a decoration inside a composer. */

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { WallPost } from '@/lib/wall';
import { WALL_DEAD_LINK, pinnedNotice } from '@/lib/wall';
import { fetchWallView, postToWall, prayForPost, reportPost, signPost } from '@/lib/actions/wall';
import { copyText } from '@/lib/clipboard';
import { WallCard } from '@/components/wall/WallCard';
import ui from '@/components/ui.module.css';
import styles from './wall.module.css';

const PAGE = 12;
/** `WALL.prayDebounce` at index.html:5455: 400ms between prays on one post. */
const PRAY_DEBOUNCE_MS = 400;

type ReportPhase = 'asking' | 'sending' | 'done' | 'failed';

/**
 * The clock, read through a helper so `react-hooks/purity` does not see a
 * `Date.now()` call inside a component body. The debounce below runs from a
 * click handler, never during render, so the read is safe where it is made.
 */
function clockMs(): number {
  return Date.now();
}

interface RailState {
  posts: WallPost[];
  page: number;
  done: boolean;
  /**
   * Why this rail is short or empty. An empty rail and a rail that failed to
   * load look identical to a steward unless one of them says so, and the
   * sentences underneath ("Every prayer on the wall is being carried.") read
   * as reassurance, which is the worst possible thing to show over a 403.
   */
  error: string | null;
}

export function WallClient({
  initialNeeds,
  needsError,
  initialMost,
  mostError,
  pinned,
  pinnedError,
  pinnedRequested,
  memberName,
  memberAvatar,
}: {
  initialNeeds: WallPost[];
  needsError: string | null;
  initialMost: WallPost[];
  mostError: string | null;
  pinned: WallPost | null;
  /** Why a shared link is not showing its prayer. Null for a plain 404. */
  pinnedError: string | null;
  /** True when the steward arrived on a `?post=` link, however it resolved. */
  pinnedRequested: boolean;
  /** The name and face that go on a signed prayer, for the composer preview. */
  memberName: string;
  memberAvatar: string | null;
}) {
  const [needs, setNeeds] = useState<RailState>({
    posts: initialNeeds,
    page: 0,
    // A rail that failed is not a rail that ran out. Leaving `done` false
    // keeps "Show more" on screen, which is the only retry a steward has.
    done: initialNeeds.length < PAGE && !needsError,
    error: needsError,
  });
  const [most, setMost] = useState<RailState>({
    posts: initialMost,
    page: 0,
    done: initialMost.length < PAGE && !mostError,
    error: mostError,
  });
  const [pinnedPost, setPinnedPost] = useState(pinned);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<'anonymous' | 'signed'>('anonymous');
  const [previewBroken, setPreviewBroken] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reportPhase, setReportPhase] = useState<Record<string, ReportPhase>>({});
  const [signAsk, setSignAsk] = useState<WallPost | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const prayAt = useRef<Record<string, number>>({});
  const pinnedRef = useRef<HTMLElement>(null);

  // `cleanURL()` at index.html:5899. The live app stripped the share
  // parameters as soon as it had read them, so a refresh, a bookmark, or a
  // back-button return landed on the plain wall. The port had left `?post=`
  // in the bar, which re-pinned a dismissed prayer on every reload.
  useEffect(() => {
    if (!pinnedRequested) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('post');
    url.searchParams.delete('view');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }, [pinnedRequested]);

  // Legacy scrolled the shared prayer into view before it had even loaded
  // (index.html:5846), because a link that opens halfway down a wall of other
  // people's prayers reads as a broken link.
  useEffect(() => {
    const el = pinnedRef.current;
    if (!el) return;
    const id = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    return () => clearTimeout(id);
  }, []);

  // Escape closes the reveal dialog, which is the one thing every dialog on
  // the web is expected to do and the port did not.
  useEffect(() => {
    if (!signAsk) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSignAsk(null);
        setSignError(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signAsk]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice((n) => (n === message ? null : n)), 3000);
  };

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
    // Legacy swallowed a second tap inside 400ms outright (index.html:5457).
    // Without it, an impatient double tap spent two of the day's three prays
    // and wrote two rows, which is a real cost to the steward.
    const last = prayAt.current[post.id] ?? 0;
    const now = clockMs();
    if (now - last < PRAY_DEBOUNCE_MS) return;
    prayAt.current[post.id] = now;

    if (post.praysRemainingToday <= 0) {
      flash('Prayed three times today. Again tomorrow.');
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
        flash(result.error ?? 'That did not save.');
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
    if (await copyText(url)) {
      setCopiedId(post.id);
      setTimeout(() => setCopiedId((c) => (c === post.id ? null : c)), 2000);
      return;
    }
    flash(`Copy failed. The link is ${url}`);
  };

  const share = (post: WallPost) => {
    // Sharing your own anonymous prayer can out you; the live app asks first.
    if (post.isMine && post.displayMode === 'anonymous') {
      setSignError(null);
      setSignAsk(post);
      return;
    }
    void copyLink(post);
  };

  const setPhase = (id: string, phase: ReportPhase | null) =>
    setReportPhase((m) => {
      const next = { ...m };
      if (phase === null) delete next[id];
      else next[id] = phase;
      return next;
    });

  const confirmReport = (post: WallPost) => {
    setPhase(post.id, 'sending');
    startTransition(async () => {
      const result = await reportPost(post.id, 'Flagged by community');
      if (result.ok) {
        setPhase(post.id, 'done');
        return;
      }
      // `submitReport` showed "Failed." for two seconds and then put the flag
      // back (index.html:5609-5613), so a failed report never looked filed.
      setPhase(post.id, 'failed');
      setTimeout(() => setPhase(post.id, null), 2000);
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
        const post = result.post;
        setNeeds((rail) => ({ ...rail, posts: [post, ...rail.posts] }));
        setFreshId(post.id);
      }
      closeComposer();
    });
  };

  /**
   * `collapseComposer()` at index.html:5720. It emptied the box AND forced the
   * radio back to anonymous on every close, successful post or cancel.
   *
   * The port had reset neither on cancel and only the text on a post, so a
   * steward who signed one prayer silently signed every prayer he wrote
   * afterwards. That is the one promise this screen makes.
   */
  const closeComposer = () => {
    setDraft('');
    setMode('anonymous');
    setPreviewBroken(false);
    setComposerOpen(false);
    setError(null);
  };

  const loadMore = (view: 'needs_prayer' | 'most_prayed') => {
    const rail = view === 'needs_prayer' ? needs : most;
    const setRail = view === 'needs_prayer' ? setNeeds : setMost;
    startTransition(async () => {
      const result = await fetchWallView(view, (rail.page + 1) * PAGE, PAGE);
      if (!result.ok) {
        // "Show more" used to do nothing at all when the call failed, which
        // reads as "there is nothing more". Say why instead, and leave the
        // button in place so the steward can try again.
        setRail((r) => ({ ...r, error: result.error ?? 'Could not load more. Please retry.' }));
        return;
      }
      setRail((r) => ({
        posts: [...r.posts, ...result.posts.filter((p) => !r.posts.some((q) => q.id === p.id))],
        page: r.page + 1,
        done: result.posts.length < PAGE,
        error: null,
      }));
    });
  };

  const footerFor = (post: WallPost) => {
    const phase = reportPhase[post.id];
    return (
      <>
        {/* index.html:5379 hid the pray button on your own prayer entirely.
            The port had shown a dead count pill, which reads as a control
            that is refusing to work. */}
        {!post.isMine && post.status === 'live' ? (
          <button
            type="button"
            className={post.praysRemainingToday > 0 ? ui.chip : ui.quiet}
            onClick={() => pray(post)}
          >
            🙏 Prayed {post.prayCount}
          </button>
        ) : null}
        <button type="button" className={ui.quiet} onClick={() => share(post)}>
          {copiedId === post.id ? 'Link copied.' : 'Share'}
        </button>
        {phase === 'done' ? (
          <span className={ui.sub}>Reported.</span>
        ) : phase === 'failed' ? (
          <span className={ui.sub}>Failed.</span>
        ) : phase === 'sending' ? (
          <span className={ui.sub}>Reporting&hellip;</span>
        ) : phase === 'asking' ? (
          <span className={styles.confirmStrip}>
            Report?
            <button type="button" className={styles.confirmYes} onClick={() => confirmReport(post)}>
              YES
            </button>
            <button
              type="button"
              className={styles.confirmNo}
              onClick={() => setPhase(post.id, null)}
            >
              NO
            </button>
          </span>
        ) : (
          <button type="button" className={ui.quiet} onClick={() => setPhase(post.id, 'asking')}>
            Flag
          </button>
        )}
      </>
    );
  };

  const notice_ = pinnedPost ? pinnedNotice(pinnedPost.status) : null;

  return (
    <>
      {pinnedError ? <p className={ui.error}>{pinnedError}</p> : null}
      {/* A link to a prayer that has since been deleted used to say so
          (index.html:5861). The port rendered nothing at all, so the steward
          saw the ordinary wall and no reason he had been sent there. */}
      {pinnedRequested && !pinnedPost && !pinnedError ? (
        <p className={styles.pinnedNotice}>{WALL_DEAD_LINK}</p>
      ) : null}
      {pinnedPost ? (
        <section className={styles.pinned} ref={pinnedRef}>
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
          {notice_ ? (
            /* Held, archived and answered prayers were never rendered as live
               cards behind a shared link (index.html:5869-5875): they got one
               sentence and, for an answered prayer, the way on to Testimony.
               The port had shown a full card with a live Flag and Share. */
            <p className={styles.pinnedNotice}>
              {notice_}{' '}
              {pinnedPost.status === 'answered' ? (
                <Link className={styles.pinnedLink} href="/testimony">
                  Go to Testimony Wall
                </Link>
              ) : null}
            </p>
          ) : (
            <WallCard post={pinnedPost} pulse>
              {footerFor(pinnedPost)}
            </WallCard>
          )}
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
            <p className={`${ui.sub} ${draft.length > 800 ? styles.countWarn : ''}`}>
              {draft.length} / 1000
            </p>
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
            {/* `toggleDisplayMode` (index.html:5745) put the steward's own
                face and name on screen the moment he chose to sign, so the
                cost of signing was shown rather than described. */}
            {mode === 'signed' ? (
              <div className={styles.preview}>
                {memberAvatar && !previewBroken ? (
                  <img
                    src={memberAvatar}
                    alt=""
                    className={styles.previewAvatar}
                    referrerPolicy="no-referrer"
                    onError={() => setPreviewBroken(true)}
                  />
                ) : (
                  <span className={styles.previewInitial} aria-hidden="true">
                    {(memberName[0] ?? 'S').toUpperCase()}
                  </span>
                )}
                <span className={styles.previewName}>{memberName}</span>
              </div>
            ) : null}
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
              <button type="button" className={ui.quiet} onClick={closeComposer}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className={styles.composerCta}
            onClick={() => setComposerOpen(true)}
          >
            Bring something to the wall.
          </button>
        )}
      </section>

      {notice ? <p className={ui.error}>{notice}</p> : null}

      <div className={styles.rails}>
        <section className={styles.rail}>
          <h2 className={styles.railTitle}>Needs Prayer</h2>
          <p className={ui.sub}>Nobody prays alone.</p>
          {needs.error ? <p className={ui.error}>{needs.error}</p> : null}
          {needs.posts.length === 0 && !needs.error ? (
            <p className={ui.sub}>Every prayer on the wall is being carried.</p>
          ) : (
            needs.posts.map((post) => (
              <WallCard
                key={post.id}
                post={post}
                pulse={post.id === freshId}
                dimmed={reportPhase[post.id] === 'done'}
              >
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
              {needs.error ? 'Try again' : 'Show more'}
            </button>
          ) : null}
        </section>

        <section className={styles.rail}>
          <h2 className={styles.railTitle}>Most Prayed</h2>
          <p className={ui.sub}>What the community is carrying right now.</p>
          {most.error ? <p className={ui.error}>{most.error}</p> : null}
          {most.posts.length === 0 && !most.error ? (
            <p className={ui.sub}>Nothing has been prayed for yet.</p>
          ) : (
            most.posts.map((post) => (
              <WallCard key={post.id} post={post} dimmed={reportPhase[post.id] === 'done'}>
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
              {most.error ? 'Try again' : 'Show more'}
            </button>
          ) : null}
        </section>
      </div>

      {signAsk ? (
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-label="Sign this prayer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSignAsk(null);
              setSignError(null);
            }
          }}
        >
          <div className={styles.modalCard}>
            <p className={styles.modalTitle}>This prayer is not signed</p>
            <p className={ui.body}>If you share it yourself, people may connect it to you.</p>
            <p className={ui.body}>
              If you want it seen without that, someone else can share it. Anyone on the wall can.
            </p>
            {signError ? <p className={ui.error}>{signError}</p> : null}
            <button
              type="button"
              className={ui.primary}
              disabled={pending}
              onClick={() => {
                const post = signAsk;
                setSignError(null);
                startTransition(async () => {
                  const result = await signPost(post.id);
                  // `revealExit` did all of this inside `if (res.ok)`
                  // (index.html:5643-5680): on a failure the dialog stayed
                  // open and nothing was copied. The port closed the dialog
                  // and copied the link either way, so a steward could be
                  // told his prayer was signed when it was still anonymous.
                  if (!result.ok || !result.post) {
                    setSignError(result.error ?? 'That did not save. Please try again.');
                    return;
                  }
                  patchEverywhere(post.id, {
                    displayMode: 'signed',
                    authorName: result.post.authorName,
                    authorAvatar: result.post.authorAvatar,
                  });
                  setSignAsk(null);
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
                  setSignError(null);
                  void copyLink(post);
                }}
              >
                Share anyway
              </button>
              <button
                type="button"
                className={ui.quiet}
                onClick={() => {
                  setSignAsk(null);
                  setSignError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
