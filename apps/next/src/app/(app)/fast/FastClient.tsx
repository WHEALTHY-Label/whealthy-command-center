'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { FastView } from '@/lib/fastview';
import {
  beginRevealedFast,
  completeFast,
  discardFast,
  endFastEarly,
  fileFastReport,
} from './actions';
import ui from '@/components/ui.module.css';
import styles from './fast.module.css';

export function FastClient({ fast }: { fast: FastView }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [stopArmed, setStopArmed] = useState(false);
  const [report, setReport] = useState('');
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? 'That did not save.');
      else router.refresh();
    });
  };

  if (fast.kind === 'none') {
    return (
      <section className={ui.card}>
        <h2 className={styles.headline}>
          What are you carrying that you need to <em>lay down?</em>
        </h2>
        <p className={ui.body}>
          Scripture chooses the pattern. You bring the commitment. Built in four minutes.
        </p>
        <p className={ui.body}>
          The guided build arrives in this new Command Center with cutover. Until then, begin your
          fast in the current app and it will show up here to carry.
        </p>
        <p className={ui.sub}>
          This tool gives no health or medical advice. We recommend talking with a healthcare
          professional before beginning any fast that changes how you eat or drink. You can end
          your fast at any time. Nothing here will shame you for it.
        </p>
      </section>
    );
  }

  if (fast.kind === 'revealed') {
    return (
      <section className={ui.cardLime}>
        <p className={ui.kicker}>{fast.name}</p>
        <h2 className={styles.headline}>Your fast is built and waiting.</h2>
        {fast.laid.length > 0 ? (
          <p className={ui.body}>Laying down: {fast.laid.join(', ')}.</p>
        ) : null}
        <button
          type="button"
          className={ui.primary}
          disabled={pending}
          onClick={() => run(beginRevealedFast)}
        >
          Begin Day 1
        </button>
        {error ? <p className={ui.error}>{error}</p> : null}
      </section>
    );
  }

  if (fast.kind === 'overrun') {
    return (
      <section className={ui.cardLime}>
        <p className={ui.kicker}>{fast.name}</p>
        <h2 className={styles.headline}>
          Day {fast.duration} of {fast.duration}. You carried it to the end.
        </h2>
        <p className={ui.body}>Close the fast and file what these days showed you.</p>
        <button
          type="button"
          className={ui.primary}
          disabled={pending}
          onClick={() => run(completeFast)}
        >
          Close the fast
        </button>
        {error ? <p className={ui.error}>{error}</p> : null}
      </section>
    );
  }

  if (fast.kind === 'closed') {
    if (fast.reportFiled) {
      return (
        <section className={ui.card}>
          <p className={ui.kicker}>Fast closed</p>
          <h2 className={styles.headline}>
            {fast.endedDay ?? fast.day} day{(fast.endedDay ?? fast.day) === 1 ? '' : 's'} of{' '}
            {fast.name} are in your record and they count.
          </h2>
          <button
            type="button"
            className={ui.quiet}
            disabled={pending}
            onClick={() => run(discardFast)}
          >
            Restart
          </button>
          {error ? <p className={ui.error}>{error}</p> : null}
        </section>
      );
    }
    return (
      <section className={ui.card}>
        <p className={ui.kicker}>
          {fast.name} · Fast closed · {fast.endedDay ?? fast.day} days elapsed
        </p>
        {fast.laid.length > 0 ? (
          <p className={ui.body}>
            <strong>What you set down:</strong> {fast.laid.join(', ')}
          </p>
        ) : null}
        {fast.whys.length > 0 ? (
          <p className={ui.body}>
            <strong>What you were seeking:</strong> {fast.whys.join(', ')}
          </p>
        ) : null}
        {fast.anchors.length > 0 ? (
          <p className={ui.body}>
            <strong>What you took on:</strong> {fast.anchors.join(', ')}
          </p>
        ) : null}
        <label className={ui.sub} htmlFor="fast-report">
          What happened?
        </label>
        <textarea
          id="fast-report"
          className={ui.textarea}
          value={report}
          onChange={(e) => setReport(e.target.value)}
          maxLength={8000}
          placeholder="Write honestly about what these days showed you before God..."
        />
        <button
          type="button"
          className={ui.primary}
          disabled={pending || !report.trim()}
          onClick={() => run(() => fileFastReport(report))}
        >
          File Report
        </button>
        {error ? <p className={ui.error}>{error}</p> : null}
      </section>
    );
  }

  // Active fast.
  return (
    <>
      <section className={ui.cardLime}>
        <p className={ui.kicker}>{fast.name}</p>
        <h2 className={styles.dayHero}>
          Day {fast.day}
          {fast.duration ? ` of ${fast.duration}` : ''}
        </h2>
        {fast.duration ? (
          <div className={ui.meterTrack} aria-hidden="true">
            <div
              className={ui.meterFill}
              style={{ width: `${Math.min(100, Math.round((fast.day / fast.duration) * 100))}%` }}
            />
          </div>
        ) : null}
        {fast.laid.length > 0 ? (
          <p className={ui.body}>
            <strong>Laid down:</strong> {fast.laid.join(', ')}
          </p>
        ) : null}
        {fast.whys.length > 0 ? (
          <p className={ui.body}>
            <strong>Why:</strong> {fast.whys.join(', ')}
          </p>
        ) : null}
        {fast.anchors.length > 0 ? (
          <p className={ui.body}>
            <strong>Taken on:</strong> {fast.anchors.join(', ')}
          </p>
        ) : null}
      </section>

      <section className={ui.card}>
        <p className={ui.kicker}>Tonight&apos;s journal</p>
        <p className={ui.body}>
          File tonight&apos;s entry in the Steward&apos;s Journal. The report gate opens at 8:45 PM
          your time.
        </p>
        <Link href="/record" className={ui.primary}>
          File Tonight&apos;s Entry
        </Link>
      </section>

      {fast.cohortId ? (
        <section className={ui.card}>
          <p className={ui.kicker}>Your cohort</p>
          <p className={ui.body}>You are carrying this fast with your cohort.</p>
          <Link href="/cohort" className={ui.quiet}>
            See the cohort board
          </Link>
        </section>
      ) : null}

      <section className={ui.card}>
        <div className={ui.row}>
          <button
            type="button"
            className={ui.danger}
            disabled={pending}
            onClick={() => {
              if (!stopArmed) {
                setStopArmed(true);
                setTimeout(() => setStopArmed(false), 5000);
                return;
              }
              setStopArmed(false);
              run(endFastEarly);
            }}
          >
            {stopArmed ? 'Tap again to stop the fast' : 'Stop Fast'}
          </button>
        </div>
        <p className={ui.sub}>
          Structure, not health advice. You may stop your fast at any time.
        </p>
        {error ? <p className={ui.error}>{error}</p> : null}
      </section>
    </>
  );
}
