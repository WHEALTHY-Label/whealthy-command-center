'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Season } from '@/lib/rhythm';
import { seasonView } from '@/lib/season';
import { commitSeason, endSeason, type SeasonResult } from './actions';
import styles from './rhythm.module.css';

/**
 * The season strip: an invitation when nothing is running, a day count while it
 * is, and a warm close when it finishes. A fast takes precedence upstream, and
 * a fast is ended in the Fast, so the end control only appears on a season the
 * steward started here.
 */
export function SeasonStrip({ season }: { season: Season }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const view = seasonView(season);

  const run = (fn: () => Promise<SeasonResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? 'That did not save.');
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  };

  if (view.kind === 'none') return null;

  const endControl = (
    <div className={styles.seasonEnd}>
      {confirming ? (
        <>
          <span className={styles.seasonConfirm}>
            End the season? Your anchors stay, only the count stops.
          </span>
          <button
            type="button"
            className={styles.seasonChip}
            disabled={pending}
            onClick={() => run(endSeason)}
          >
            {pending ? 'Ending' : 'Yes, end it'}
          </button>
          <button
            type="button"
            className={styles.seasonQuiet}
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Keep going
          </button>
        </>
      ) : (
        <button
          type="button"
          className={styles.seasonQuiet}
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          End this season
        </button>
      )}
    </div>
  );

  return (
    <section className={styles.seasonStrip} aria-label="Season">
      {view.kind === 'offer' ? (
        <>
          <p className={styles.seasonLine}>{view.line}</p>
          <div className={styles.seasonOptions}>
            {view.options.map((len) => (
              <button
                key={len}
                type="button"
                className={styles.seasonChip}
                disabled={pending}
                onClick={() => run(() => commitSeason(len))}
              >
                {len} days
              </button>
            ))}
          </div>
        </>
      ) : null}

      {view.kind === 'running' ? (
        <>
          <div className={styles.seasonHead}>
            <span className={styles.seasonLabel}>{view.label}</span>
            <span className={styles.seasonLeft}>{view.leftLine}</span>
          </div>
          <div
            className={styles.seasonTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={view.total}
            aria-valuenow={view.day}
            aria-valuetext={`Day ${view.day} of ${view.total}`}
          >
            {/* The only inline style on the page: the fill is a live value. */}
            <div className={styles.seasonBar} style={{ width: `${view.percent}%` }} />
          </div>
          <p className={styles.seasonDay}>
            Day {view.day} of {view.total}
            {view.withCohort ? <span className={styles.cohortNote}> with your cohort</span> : null}
          </p>
          {view.canEnd ? endControl : null}
        </>
      ) : null}

      {view.kind === 'complete' ? (
        <>
          <p className={styles.seasonDone}>{view.line}</p>
          {view.canEnd ? endControl : null}
        </>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}
