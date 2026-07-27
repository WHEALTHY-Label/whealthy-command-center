'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { WallPost } from '@/lib/wall';
import { fetchWallView, postToWall, prayForPost } from '@/lib/actions/wall';
import { reportFirstStep } from '@/lib/actions/tour';
import ui from '@/components/ui.module.css';
import styles from './bible.module.css';

/**
 * The third sanctuary task: Community Prayer.
 *
 * Two things happen here, and both write to the same place the Wall does.
 * A steward can bring their own request (`wall-post` with `source: 'bible365'`,
 * so it is a real wall post and shows up on the Wall, in My Prayers, and in
 * anyone's testimony river once it is answered), and can carry someone else's
 * (`wall-pray`, the same three-a-day budget the Wall enforces).
 *
 * The check beside the task is not a browser flag. It is true when the member
 * has a wall post dated today, computed on the server from `my_prayers` and
 * handed down as `broughtToday`. Clearing a cache or opening a second device
 * does not change the answer.
 */
export function SanctuaryPrayer({
  broughtToday,
  initialFeed,
  initialFeedError,
}: {
  broughtToday: boolean;
  initialFeed: WallPost[];
  /**
   * Why the feed is empty when the read failed. "No active prayers on the wall"
   * is a fact about the community, and it must not be printed over a session
   * that has expired or a function that could not be reached.
   */
  initialFeedError: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(broughtToday);
  const [feed, setFeed] = useState(initialFeed);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'anonymous' | 'signed'>('anonymous');
  const [error, setError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(initialFeedError);
  const [pending, startTransition] = useTransition();

  /**
   * A failed reload used to leave the previous feed in place and say nothing,
   * so opening the drawer after a session expired showed a stale list, and
   * opening it on a fresh page showed the "yours can be the first" line.
   */
  const refreshFeed = async () => {
    const result = await fetchWallView('bible365', 0, 10);
    if (!result.ok) {
      setFeedError(result.error ?? 'Could not load the wall just now. Please retry.');
      return;
    }
    setFeedError(null);
    setFeed(result.posts);
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const result = await postToWall(body, mode, 'bible365');
      if (!result.ok) {
        setError(result.error ?? 'That did not save.');
        return;
      }
      setText('');
      setDone(true);
      // Bringing a prayer here is the same first step as bringing one on the
      // Wall, exactly as the live app treated it.
      void reportFirstStep('wall');
      await refreshFeed();
      router.refresh();
    });
  };

  /**
   * Carrying someone moves the count at once and puts it back if the write is
   * refused, so a steward is never told they prayed when the server disagreed.
   */
  const carry = (post: WallPost) => {
    if (post.praysRemainingToday <= 0) return;
    setError(null);
    const before = { prayCount: post.prayCount, praysRemainingToday: post.praysRemainingToday };
    const patch = (p: Partial<WallPost>) =>
      setFeed((posts) => posts.map((x) => (x.id === post.id ? { ...x, ...p } : x)));
    patch({
      prayCount: post.prayCount + 1,
      praysRemainingToday: post.praysRemainingToday - 1,
    });
    startTransition(async () => {
      const result = await prayForPost(post.id);
      if (!result.ok) {
        patch(before);
        setError(result.error ?? 'That did not save.');
        return;
      }
      patch({
        prayCount: result.prayCount ?? post.prayCount + 1,
        praysRemainingToday: result.praysRemaining ?? post.praysRemainingToday - 1,
      });
    });
  };

  return (
    <section className={ui.card}>
      <button
        type="button"
        className={styles.taskRow}
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void refreshFeed();
        }}
      >
        <span className={done ? styles.taskBoxDone : styles.taskBox} aria-hidden="true">
          {done ? '✓' : ''}
        </span>
        <span className={styles.taskName}>Community Prayer</span>
        <span className={ui.sub}>{open ? 'Hide' : 'Open'}</span>
      </button>

      {open ? (
        <div className={styles.drawer}>
          <label className={ui.kicker} htmlFor="b365-prayer">
            Request prayer
          </label>
          <textarea
            id="b365-prayer"
            className={ui.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder="Write down your prayer request..."
          />
          <div className={styles.modeRow} role="radiogroup" aria-label="How this appears">
            <label className={styles.checkLine}>
              <input
                type="radio"
                name="b365-display-mode"
                value="anonymous"
                checked={mode === 'anonymous'}
                onChange={() => setMode('anonymous')}
              />
              Anonymous
            </label>
            <label className={styles.checkLine}>
              <input
                type="radio"
                name="b365-display-mode"
                value="signed"
                checked={mode === 'signed'}
                onChange={() => setMode('signed')}
              />
              Signed
            </label>
          </div>
          <button
            type="button"
            className={ui.primary}
            disabled={pending || text.trim().length === 0}
            onClick={submit}
          >
            Log request
          </button>
          {error ? <p className={ui.error}>{error}</p> : null}

          <div className={ui.divider} />

          <p className={ui.kicker}>Pray over fellow stewards</p>
          {feedError ? <p className={ui.error}>{feedError}</p> : null}
          {feed.length === 0 && !feedError ? (
            <p className={ui.sub}>No active prayers on the wall. Yours can be the first.</p>
          ) : (
            <ul className={styles.feed}>
              {feed.map((post) => (
                <li key={post.id} className={styles.feedRow}>
                  <div className={styles.feedText}>
                    <span className={styles.feedName}>
                      {post.displayMode === 'signed' ? post.authorName : 'A Steward'}
                    </span>
                    <p className={styles.feedBody}>{post.body}</p>
                  </div>
                  <button
                    type="button"
                    className={post.praysRemainingToday > 0 ? ui.chip : ui.chipActive}
                    disabled={pending || post.praysRemainingToday <= 0}
                    onClick={() => carry(post)}
                  >
                    {post.praysRemainingToday > 0 ? '🙏 Pray' : '✓ Prayed'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
