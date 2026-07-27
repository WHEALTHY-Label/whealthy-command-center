'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { RevealData } from '@/lib/fastreveal';
import { splitPlanName } from '@/lib/fastreveal';
import { HoldButton } from './build/HoldButton';
import { ScriptureRefs } from './build/ScriptureRefs';
import { beginRevealedFast, discardFast, dismissEquipCard } from './actions';
import ui from '@/components/ui.module.css';
import styles from './build/wizard.module.css';

/**
 * The plan reveal, the screen a member lands on the moment their fast is
 * forged and every time they return before Day 1 begins. It mirrors the live
 * app's cascading card stack: the plan, the rules, the schedule, the phases,
 * the prayer plan, what happens after, and an optional equip card.
 *
 * Beginning is a press and hold rather than a tap, deliberately: a fast is
 * entered, not clicked into.
 */
export function RevealClient({ reveal }: { reveal: RevealData }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Seeded from the plan, not from `false`, so an answer already given does not
  // come back on the next reload.
  const [equipDismissed, setEquipDismissed] = useState(reveal.equipDismissed);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? 'That did not save.');
      else router.refresh();
    });
  };

  /**
   * The card goes down at once, because a steward declining an offer should not
   * wait on a round trip. If the write fails the card comes back rather than
   * lying about having been remembered.
   */
  const dismissEquip = () => {
    setError(null);
    setEquipDismissed(true);
    startTransition(async () => {
      const result = await dismissEquipCard();
      if (!result.ok) {
        setEquipDismissed(false);
        setError(result.error ?? 'That did not save.');
      } else {
        router.refresh();
      }
    });
  };

  const title = splitPlanName(reveal.name);

  return (
    <>
      <section className={`${ui.cardLime} ${styles.reveal}`}>
        <div className={styles.revealTop}>
          <h2 className={styles.planName}>
            {title.before}
            {title.number ? <em>{title.number}</em> : null}
            {title.after}
          </h2>
          {reveal.range ? <p className={styles.planRange}>{reveal.range}</p> : null}
          {reveal.modelLine ? <p className={styles.planLine}>{reveal.modelLine}</p> : null}
          <ScriptureRefs refs={reveal.refs} />
          <div className={styles.revealActions}>
            <HoldButton
              label="Hold to Begin Day 1"
              disabled={pending}
              onComplete={() => run(beginRevealedFast)}
            />
            <button
              type="button"
              className={ui.quiet}
              disabled={pending}
              onClick={() => run(discardFast)}
            >
              Start Over
            </button>
          </div>
          <p className={styles.planRange}>Press and hold to begin.</p>
        </div>
        {error ? <p className={ui.error}>{error}</p> : null}
      </section>

      {reveal.rules.length > 0 ? (
        <section className={`${ui.card} ${styles.reveal}`}>
          <p className={styles.secTitle}>The Rules</p>
          <ol className={styles.rules}>
            {reveal.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <p className={styles.grace}>
            Miss a rule, note it in your journal, own it, and get back on track the next morning. Do
            not quit the fast over one bad day.
          </p>
        </section>
      ) : null}

      {reveal.schedule.length > 0 ? (
        <section className={`${ui.card} ${styles.reveal}`}>
          <p className={styles.secTitle}>The Daily Schedule</p>
          {reveal.schedule.map((s) => (
            <div key={`${s.time}-${s.action}`} className={styles.schedRow}>
              <span className={styles.schedTime}>{s.time}</span>
              <span>{s.action}</span>
            </div>
          ))}
        </section>
      ) : null}

      {reveal.phases.length > 0 ? (
        <section className={`${ui.card} ${styles.reveal}`}>
          <p className={styles.secTitle}>The Phases</p>
          {reveal.phases.map((p) => (
            <div key={`${p.from}-${p.name}`} className={styles.phase}>
              <p className={styles.phaseMeta}>
                Days {p.from} to {p.to}
                {p.theme ? ` · ${p.theme}` : ''}
              </p>
              <h3 className={styles.phaseName}>{p.name}</h3>
              {p.goal ? <p className={ui.body}>{p.goal}</p> : null}
              {p.milestone ? <p className={styles.milestone}>Milestone: {p.milestone}</p> : null}
              {reveal.focus[p.name] && reveal.focus[p.name]!.length > 0 ? (
                <ul className={styles.focusList}>
                  {reveal.focus[p.name]!.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {reveal.prayerPlan.length > 0 ? (
        <section className={`${ui.card} ${styles.reveal}`}>
          <p className={styles.secTitle}>The Prayer Plan</p>
          {reveal.prayerPlan.map((w) => (
            <div key={w.week} className={styles.prayerWeek}>
              <p className={styles.prayerWeekLabel}>Week {w.week}</p>
              {w.theme ? <p className={styles.prayerTheme}>{w.theme}</p> : null}
              <ScriptureRefs
                refs={[w.morning, w.night].filter((r) => r.length > 0)}
                className={styles.prayerRefs}
              />
            </div>
          ))}
          <p className={styles.grace}>
            Read the morning passage and pray through it. Return to it at night and pray it back
            over your day.
          </p>
        </section>
      ) : null}

      {reveal.after.keep || reveal.after.return ? (
        <section className={`${ui.card} ${styles.reveal}`}>
          <p className={styles.secTitle}>After the Fast</p>
          {reveal.after.keep ? <p className={ui.body}>{reveal.after.keep}</p> : null}
          {reveal.after.return ? <p className={ui.body}>{reveal.after.return}</p> : null}
          <p className={ui.body}>
            Reread your Day 1 and final day journal entries side by side. They will both be in The
            Record.
          </p>
        </section>
      ) : null}

      {reveal.productState === 'unequipped' && !equipDismissed ? (
        <section className={`${ui.card} ${styles.reveal}`}>
          <p className={styles.secTitle}>Equip the Fast</p>
          <p className={ui.body}>
            Your plan sets a {reveal.oz} oz hydration rhythm. Stewards run it with a governed
            routine. Optional, and your fast is complete without it.
          </p>
          <div className={styles.revealActions}>
            <Link href="/portal" className={ui.primary}>
              Find What Fits
            </Link>
            <button type="button" className={ui.quiet} disabled={pending} onClick={dismissEquip}>
              Not During This Fast
            </button>
          </div>
        </section>
      ) : null}

      {reveal.productState === 'lapsed' ? (
        <section className={`${ui.card} ${styles.reveal}`}>
          <p className={ui.body}>
            Your next bundle is claimable in the Command Center whenever you are ready. Your fast
            needs nothing to begin.
          </p>
        </section>
      ) : null}

      <p className={styles.footNote}>
        This tool provides structure, not health or medical advice. We recommend consulting a
        healthcare professional before beginning any fast that changes how you eat or drink. Your
        fast is yours, and you may end it at any time.
      </p>
    </>
  );
}
