'use client';

import { useEffect, useState } from 'react';
import { fetchDashPersonalization } from '@/lib/actions/personalize';
import { allowCommunityDirective, mentionsWall, timeGreeting } from '@/lib/personalize';
import styles from './page.module.css';

/** The legacy key, so a steward who used the old app keeps their spacing. */
const NUDGE_KEY = 'wh_daily_comm_nudge_shown_at';

function readNudge(): string | null {
  try {
    return window.localStorage.getItem(NUDGE_KEY);
  } catch {
    // Storage blocked. Treat it as never nudged rather than losing the call.
    return null;
  }
}

function stampNudge(iso: string): void {
  try {
    window.localStorage.setItem(NUDGE_KEY, iso);
  } catch {
    // A blocked write only costs the five day spacing, not the directive.
  }
}

/**
 * The Command Center greeting and Daily Directive.
 *
 * The heading and the directive both arrive server rendered, then the AI
 * personalization is fetched after mount, exactly as the live app did with
 * `setTimeout(waFetchAIPersonalization, 150)` at index.html:18351. The card is
 * never blank and never waits on the model: if the call fails, is refused, or
 * the steward is offline, what the server rendered simply stays.
 *
 * Two things can only be known in the browser, so they are read after mount:
 * the steward's local hour (the greeting is local time of day, and the server
 * has no idea what time it is where they are standing) and the community nudge
 * stamp in localStorage.
 */
export function DirectiveCard({
  firstName,
  directive,
  fastActive,
}: {
  firstName: string;
  /** What the server already resolved: the fast line, or the steady fallback. */
  directive: string;
  /**
   * True when an active fast owns the directive line. `renderDash` at
   * index.html:15895 gives the fast line precedence over the AI directive on
   * every render, so Day N of D is not overwritten here either. A steward
   * mid-fast needs the day count more than a generated sentence.
   */
  fastActive: boolean;
}) {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [aiTitle, setAiTitle] = useState<string | null>(null);
  const [line, setLine] = useState(directive);

  useEffect(() => {
    let alive = true;

    // The local hour has to be read outside render: react-hooks/purity bars a
    // clock read during render, and a server rendered hour would hydrate
    // wrong for every steward outside the server's timezone.
    const greetTimer = setTimeout(() => {
      if (alive) setGreeting(timeGreeting(new Date().getHours()));
    }, 0);

    const askTimer = setTimeout(() => {
      void (async () => {
        const now = Date.now();
        const result = await fetchDashPersonalization(
          new Date(now).getHours(),
          allowCommunityDirective(readNudge(), now),
        );
        if (!alive || !result.ok || !result.personalization) return;
        const p = result.personalization;
        if (p.dashTitle) setAiTitle(p.dashTitle);
        if (p.dailyDirective && !fastActive) setLine(p.dailyDirective);
        // Only a directive that actually mentioned the wall spends the nudge.
        if (mentionsWall(p.dailyDirective)) stampNudge(new Date(Date.now()).toISOString());
      })();
    }, 150);

    return () => {
      alive = false;
      clearTimeout(greetTimer);
      clearTimeout(askTimer);
    };
  }, [fastActive]);

  // Server renders the hour-agnostic greeting so the hydrated tree matches,
  // then the local hour refines it, then the model's own title replaces it.
  const heading = aiTitle ?? `${greeting ?? 'Welcome back'}, ${firstName}`;

  return (
    <section className={`${styles.card} ${styles.directiveCard}`}>
      <p className={styles.eyebrow}>Command Center</p>
      <h1 className={styles.name}>{heading}</h1>
      <p className={styles.directiveLabel}>Daily Directive</p>
      <p className={styles.directive}>{line}</p>
    </section>
  );
}
