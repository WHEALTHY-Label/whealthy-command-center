'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  dayCompletion,
  formatAdherence,
  groupByWindow,
  type RhythmStatus,
  type RhythmSlot,
} from '@/lib/rhythm';
import { checkInSlot } from './actions';
import { NudgeToasts } from './NudgeToasts';
import { SeasonStrip } from './SeasonStrip';
import styles from './rhythm.module.css';

export function RhythmDay({ status, icsUrl }: { status: RhythmStatus; icsUrl: string | null }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Optimistic done-state overrides, keyed by slot id.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const slots: RhythmSlot[] = status.slots.map((s) =>
    s.id in overrides ? { ...s, done: overrides[s.id]! } : s,
  );
  const groups = groupByWindow(slots);
  const completion = dayCompletion(slots);

  const toggle = (slot: RhythmSlot) => {
    const next = !slot.done;
    setOverrides((o) => ({ ...o, [slot.id]: next }));
    setError(null);
    startTransition(async () => {
      const result = await checkInSlot(slot.id, next);
      if (!result.ok) {
        // Roll back the optimistic change.
        setOverrides((o) => ({ ...o, [slot.id]: !next }));
        setError(result.error ?? 'That did not save.');
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>My Rhythm</p>
        <h1 className={styles.title}>Your governed day</h1>
        <p className={styles.sub}>
          Check off each anchor as you carry it. Grace covers a missed day.
        </p>
      </header>

      <SeasonStrip season={status.season} />

      {/* Only a live rhythm has nudges to spend, and asking without one costs a
          call that answers with an empty list. */}
      {status.active ? <NudgeToasts suppressFreshStart={status.freshStart} /> : null}

      {status.freshStart ? (
        <div className={styles.freshStart}>
          A fresh week. Pick one anchor and begin again, nothing to make up.
        </div>
      ) : null}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {completion.done}/{completion.total}
          </span>
          <span className={styles.statLabel}>today</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{formatAdherence(status.adherence7)}</span>
          <span className={styles.statLabel}>7-day</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{status.consistencyDays}</span>
          <span className={styles.statLabel}>days carried</span>
        </div>
      </div>

      {completion.complete ? (
        <p className={styles.dayComplete}>Day complete. Well carried.</p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {groups.length === 0 ? (
        <div className={styles.empty}>
          <p>No rhythm yet. Your assessment builds it with you, one anchor at a time.</p>
          <Link href="/rhythm/assess" className={styles.beginLink}>
            Begin your assessment
          </Link>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.window} className={styles.group}>
            <p className={styles.groupTitle}>{group.label}</p>
            <ul className={styles.slots}>
              {group.slots.map((slot) => (
                <li key={slot.id} className={styles.slot}>
                  <button
                    type="button"
                    className={`${styles.check} ${slot.done ? styles.checkDone : ''}`}
                    aria-pressed={slot.done}
                    aria-label={slot.done ? `Undo ${slot.title}` : `Mark ${slot.title} done`}
                    onClick={() => toggle(slot)}
                  />
                  <div className={styles.slotBody}>
                    <div className={styles.slotHead}>
                      <span className={slot.done ? styles.slotTitleDone : styles.slotTitle}>
                        {slot.title}
                      </span>
                      {slot.cue ? <span className={styles.slotCue}>{slot.cue}</span> : null}
                    </div>
                    {slot.ifThen ? <p className={styles.ifThen}>{slot.ifThen}</p> : null}
                    {slot.why ? <p className={styles.why}>{slot.why}</p> : null}
                    {slot.productUnclaimed ? (
                      <Link href="/claim" className={styles.serviceLine}>
                        This slot is open. Your bundle covers it.
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {icsUrl ? (
        <a href={icsUrl} className={styles.subscribe}>
          Subscribe to your rhythm
        </a>
      ) : null}
    </div>
  );
}
