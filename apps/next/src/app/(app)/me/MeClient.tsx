'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import type { WallPost } from '@/lib/wall';
import { editHoursLeft } from '@/lib/wall';
import {
  amenPost,
  answerPost,
  editAnswerNote,
  markSeen,
  prayForPost,
  signPost,
} from '@/lib/actions/wall';
import { WallCard } from '@/components/wall/WallCard';
import ui from '@/components/ui.module.css';
import styles from './me.module.css';

type Tab = 'mine' | 'watching';
type Modal =
  | { kind: 'answer'; post: WallPost }
  | { kind: 'edit'; post: WallPost }
  | { kind: 'sign'; post: WallPost }
  | null;

export function MeClient({ mine, watching }: { mine: WallPost[]; watching: WallPost[] }) {
  const [tab, setTab] = useState<Tab>('mine');
  const [minePosts, setMinePosts] = useState(mine);
  const [watchPosts, setWatchPosts] = useState(watching);
  const [modal, setModal] = useState<Modal>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const unseen = watchPosts.filter((p) => p.hasUnseenAnswer).length;

  // The edit-window countdown needs a clock; read it once after mount so the
  // hydrated tree matches the server HTML.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(id);
  }, []);

  // Answered prayers the member carried get stamped seen after a short dwell
  // on the Praying For tab; the badge then settles down.
  const seenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (tab !== 'watching') return;
    const unseenIds = watchPosts.filter((p) => p.hasUnseenAnswer).map((p) => p.id);
    if (unseenIds.length === 0) return;
    seenTimer.current = setTimeout(() => {
      for (const id of unseenIds) void markSeen(id);
      setWatchPosts((posts) =>
        posts.map((p) => (p.hasUnseenAnswer ? { ...p, hasUnseenAnswer: false } : p)),
      );
    }, 1500);
    return () => {
      if (seenTimer.current) clearTimeout(seenTimer.current);
    };
  }, [tab, watchPosts]);

  const patchMine = (id: string, patch: Partial<WallPost>) =>
    setMinePosts((posts) => posts.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const patchWatch = (id: string, patch: Partial<WallPost>) =>
    setWatchPosts((posts) => posts.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const submitModal = () => {
    if (!modal) return;
    setError(null);
    startTransition(async () => {
      if (modal.kind === 'answer') {
        const result = await answerPost(modal.post.id, note);
        if (!result.ok) {
          setError(result.error ?? 'That did not save.');
          return;
        }
        if (result.post) patchMine(modal.post.id, result.post);
      } else if (modal.kind === 'edit') {
        const result = await editAnswerNote(modal.post.id, note);
        if (!result.ok) {
          setError(result.error ?? 'That did not save.');
          return;
        }
        if (result.post) patchMine(modal.post.id, result.post);
      } else {
        const result = await signPost(modal.post.id);
        if (!result.ok) {
          setError(result.error ?? 'That did not save.');
          return;
        }
        if (result.post) {
          patchMine(modal.post.id, {
            displayMode: 'signed',
            authorName: result.post.authorName,
            authorAvatar: result.post.authorAvatar,
          });
        }
      }
      setModal(null);
      setNote('');
    });
  };

  return (
    <>
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'mine'}
          className={tab === 'mine' ? styles.tabActive : styles.tab}
          onClick={() => setTab('mine')}
        >
          My Prayers
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'watching'}
          className={tab === 'watching' ? styles.tabActive : styles.tab}
          onClick={() => setTab('watching')}
        >
          Praying For{unseen > 0 ? <span className={styles.dot} aria-label={`${unseen} new answers`} /> : null}
        </button>
      </div>

      {tab === 'mine' ? (
        minePosts.length === 0 ? (
          <div className={ui.empty}>
            <p>You have not brought anything to the wall.</p>
            <Link href="/wall" className={ui.quiet}>
              Bring yours here
            </Link>
          </div>
        ) : (
          minePosts.map((post) => {
            const hoursLeft = now === null ? 0 : editHoursLeft(post.answeredNoteLockedAt, now);
            return (
              <WallCard key={post.id} post={post} showTrack>
                {post.status === 'answered' ? (
                  hoursLeft > 0 ? (
                    <>
                      <button
                        type="button"
                        className={ui.quiet}
                        onClick={() => {
                          setNote(post.answeredNote ?? '');
                          setModal({ kind: 'edit', post });
                        }}
                      >
                        {post.answeredNote ? 'Edit note' : 'Add note'}
                      </button>
                      <span className={ui.sub}>
                        You can edit this note for {hoursLeft} more hour{hoursLeft === 1 ? '' : 's'}.
                      </span>
                    </>
                  ) : null
                ) : post.status === 'live' || post.status === 'archived' ? (
                  <>
                    <button
                      type="button"
                      className={ui.chip}
                      onClick={() => {
                        setNote('');
                        setModal({ kind: 'answer', post });
                      }}
                    >
                      Mark Answered
                    </button>
                    {post.status === 'archived' ? (
                      <span className={ui.sub}>
                        This prayer left the wall. It was carried for 30 days.
                      </span>
                    ) : (
                      <span className={ui.sub}>🙏 {post.prayCount}</span>
                    )}
                  </>
                ) : null}
                {post.displayMode === 'anonymous' && post.status !== 'held' ? (
                  <button
                    type="button"
                    className={ui.quiet}
                    onClick={() => setModal({ kind: 'sign', post })}
                  >
                    Sign it
                  </button>
                ) : null}
              </WallCard>
            );
          })
        )
      ) : watchPosts.length === 0 ? (
        <div className={ui.empty}>
          <p>You have not prayed for anything yet.</p>
          <Link href="/wall" className={ui.quiet}>
            Visit the wall
          </Link>
        </div>
      ) : (
        watchPosts.map((post) => (
          <WallCard key={post.id} post={post} showTrack highlight={post.hasUnseenAnswer}>
            {post.status === 'answered' ? (
              <button
                type="button"
                className={post.hasAmened ? ui.chipActive : ui.chip}
                onClick={() => {
                  if (post.hasAmened) return;
                  patchWatch(post.id, { amenCount: post.amenCount + 1, hasAmened: true });
                  startTransition(async () => {
                    const result = await amenPost(post.id);
                    if (!result.ok) {
                      patchWatch(post.id, { amenCount: post.amenCount, hasAmened: false });
                    }
                  });
                }}
              >
                {post.hasAmened ? '✓ ' : ''}Amen · {post.amenCount}
              </button>
            ) : post.status === 'live' ? (
              <button
                type="button"
                className={post.praysRemainingToday > 0 ? ui.chip : ui.quiet}
                onClick={() => {
                  if (post.praysRemainingToday <= 0) return;
                  patchWatch(post.id, {
                    prayCount: post.prayCount + 1,
                    praysRemainingToday: post.praysRemainingToday - 1,
                  });
                  startTransition(async () => {
                    const result = await prayForPost(post.id);
                    if (!result.ok) {
                      patchWatch(post.id, {
                        prayCount: post.prayCount,
                        praysRemainingToday: post.praysRemainingToday,
                      });
                    }
                  });
                }}
              >
                {post.praysRemainingToday > 0
                  ? `Carry · ${post.praysRemainingToday} left`
                  : '✓ Carried'}
              </button>
            ) : null}
          </WallCard>
        ))
      )}

      {modal ? (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            {modal.kind === 'sign' ? (
              <>
                <p className={styles.modalTitle}>Sign This Prayer</p>
                <p className={ui.body}>
                  Your name and photo will appear on it. Everyone on the wall will see it. This
                  cannot be undone.
                </p>
              </>
            ) : (
              <>
                <p className={styles.modalTitle}>Answered</p>
                <p className={ui.body}>What happened?</p>
                <textarea
                  className={ui.textarea}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  placeholder="Describe how God answered this prayer... (optional)"
                />
                {modal.kind === 'answer' ? (
                  <p className={ui.sub}>You can add this later or leave it blank.</p>
                ) : null}
              </>
            )}
            {error ? <p className={ui.error}>{error}</p> : null}
            <div className={ui.row}>
              <button type="button" className={ui.primary} disabled={pending} onClick={submitModal}>
                {modal.kind === 'sign' ? 'Sign It' : modal.kind === 'edit' ? 'Save Note' : 'Mark Answered'}
              </button>
              <button
                type="button"
                className={ui.quiet}
                onClick={() => {
                  setModal(null);
                  setError(null);
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
