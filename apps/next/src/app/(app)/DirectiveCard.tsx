'use client';

import { useRequestedPersonalization } from './PersonalizationProvider';
import styles from './page.module.css';

/**
 * The Command Center greeting and Daily Directive.
 *
 * The heading and the directive both arrive server rendered, then the AI
 * personalization is laid over the top once it lands, exactly as the live app
 * did with `setTimeout(waFetchAIPersonalization, 150)` at index.html:18351.
 * The card is never blank and never waits on the model: if the call fails, is
 * refused, or the steward is offline, what the server rendered simply stays.
 *
 * The call itself lives in `PersonalizationProvider`, because the same answer
 * also personalizes the My Journal and The Fast headers and the live app only
 * ever asked once.
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
  const { ai, greeting } = useRequestedPersonalization();
  // Derived, not stored: the directive is a pure function of what the server
  // rendered and what the model has said so far, so there is nothing to keep
  // in state and nothing to re-sync when the answer lands.
  const line = ai?.dailyDirective && !fastActive ? ai.dailyDirective : directive;

  // Both fields or neither, which is the one place legacy insisted on it:
  // `aiMap.dash` at index.html:18538 had no per-field fallback, so the guard at
  // 18546 kept the deterministic greeting whenever the model returned a title
  // without a subtitle. `triggerWelcomeCelebration` (18577) checked the same
  // pair.
  const aiTitle = ai?.dashTitle && ai.dashSubtitle ? ai.dashTitle : null;
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
