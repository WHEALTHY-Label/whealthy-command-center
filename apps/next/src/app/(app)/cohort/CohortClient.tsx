'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CohortBoard } from '@/lib/circles';
import type { FastView } from '@/lib/fastview';
import { joinCohort, postCohortTestimony } from './actions';
import ui from '@/components/ui.module.css';
import styles from './cohort.module.css';

export function CohortClient({ fast, board }: { fast: FastView; board: CohortBoard | null }) {
  const router = useRouter();
  const [cohortId, setCohortId] = useState('');
  const [armed, setArmed] = useState(false);
  const [testimony, setTestimony] = useState('');
  const [mode, setMode] = useState<'signed' | 'anonymous'>('signed');
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [pending, startTransition] = useTransition();

  if (fast.kind === 'none') {
    return (
      <div className={ui.empty}>
        <p>
          🏆 No active fast. Cohort challenges are tied to active fasts. Start a fast first to
          join a group challenge.
        </p>
        <Link href="/fast" className={ui.primary}>
          Start fasting
        </Link>
      </div>
    );
  }

  const boardCard = board ? (
    <section className={ui.cardLime}>
      <p className={ui.kicker}>{board.name}</p>
      <p className={ui.body}>
        Day {board.day} of {board.of} · Status: {board.status}
      </p>
      {board.members.length === 0 ? (
        <p className={ui.sub}>No cohort members have filed entries yet.</p>
      ) : (
        <ul className={styles.board}>
          {board.members.map((m, i) => (
            <li key={`${m.name}-${i}`} className={ui.listRow}>
              <span className={styles.boardName}>{m.name}</span>
              <span className={ui.sub}>
                {m.daysKept} day{m.daysKept === 1 ? '' : 's'} kept
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  ) : null;

  if (fast.kind === 'closed' || fast.kind === 'overrun') {
    return (
      <>
        {boardCard}
        {fast.cohortId ? (
          <section className={ui.card}>
            <p className={ui.kicker}>Share cohort testimony</p>
            <p className={ui.body}>
              Consistent stewardship compounds when shared. Would you like to post a testimony of
              this cohort fast to the Prayer Wall?
            </p>
            {posted ? (
              <p className={ui.good}>Posted to the Prayer Wall.</p>
            ) : (
              <>
                <textarea
                  className={ui.textarea}
                  value={testimony}
                  onChange={(e) => setTestimony(e.target.value)}
                  maxLength={1000}
                  placeholder="What did these days show you?"
                />
                <div className={ui.row}>
                  <select
                    className={`${ui.select} ${styles.modeSelect}`}
                    value={mode}
                    onChange={(e) => setMode(e.target.value === 'anonymous' ? 'anonymous' : 'signed')}
                    aria-label="Post as"
                  >
                    <option value="signed">My name</option>
                    <option value="anonymous">Anonymous</option>
                  </select>
                  <button
                    type="button"
                    className={ui.primary}
                    disabled={pending || !testimony.trim()}
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        const result = await postCohortTestimony(testimony, mode);
                        if (!result.ok) setError(result.error ?? 'That did not save.');
                        else setPosted(true);
                      });
                    }}
                  >
                    Post to Prayer Wall
                  </button>
                </div>
                <p className={ui.sub}>Only if you want to. The app never posts for you.</p>
                {error ? <p className={ui.error}>{error}</p> : null}
              </>
            )}
          </section>
        ) : (
          <div className={ui.empty}>
            <p>🏆 Your fast has ended. You were not in a cohort during this fast.</p>
            <Link href="/fast" className={ui.quiet}>
              Restart fasting
            </Link>
          </div>
        )}
      </>
    );
  }

  // Active fast.
  if (fast.cohortId) return boardCard;

  return (
    <section className={ui.card}>
      <p className={ui.kicker}>Join a challenge</p>
      <p className={ui.body}>Fast together. Enter the Cohort ID below to join your group:</p>
      <div className={ui.row}>
        <input
          className={ui.input}
          value={cohortId}
          onChange={(e) => {
            setCohortId(e.target.value);
            setArmed(false);
          }}
          placeholder="Cohort ID"
          autoComplete="off"
        />
        <button
          type="button"
          className={armed ? ui.primary : ui.quiet}
          disabled={pending || !cohortId.trim()}
          onClick={() => {
            if (!armed) {
              setArmed(true);
              setTimeout(() => setArmed(false), 4000);
              return;
            }
            setError(null);
            startTransition(async () => {
              const result = await joinCohort(cohortId);
              if (!result.ok) setError(result.error ?? 'That did not save.');
              else router.refresh();
            });
          }}
        >
          {armed ? 'Tap again to confirm' : 'Join challenge'}
        </button>
      </div>
      {error ? <p className={ui.error}>{error}</p> : null}
    </section>
  );
}
