'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Nudge } from '@/lib/nudges';
import { checkNudges } from './actions';
import styles from './rhythm.module.css';

/**
 * Warm nudges, asked for once when the page mounts.
 *
 * `rhythm-nudge-check` records every nudge it hands back and then holds that
 * kind for eighteen hours, so a second call inside the same visit answers with
 * nothing and would wipe what the first call is showing. The ref guard is what
 * keeps that from happening: it survives React's development remount, while a
 * cleanup flag would discard the first response mid-flight and leave the page
 * silent with the nudge already spent.
 */
export function NudgeToasts({ suppressFreshStart }: { suppressFreshStart: boolean }) {
  const asked = useRef(false);
  const [nudges, setNudges] = useState<Nudge[]>([]);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void checkNudges(suppressFreshStart).then(setNudges);
  }, [suppressFreshStart]);

  const dismiss = (id: string) => setNudges((list) => list.filter((n) => n.id !== id));

  if (nudges.length === 0) return null;

  return (
    <div className={styles.nudges} role="status" aria-live="polite">
      {nudges.map((nudge) => (
        <div key={nudge.id} className={styles.nudge}>
          <div className={styles.nudgeBody}>
            <p className={styles.nudgeCopy}>{nudge.copy}</p>
            {nudge.kind === 'product_slot' ? (
              <Link href="/claim" className={styles.nudgeLink}>
                See what covers it
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.nudgeClose}
            aria-label="Dismiss"
            onClick={() => dismiss(nudge.id)}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
