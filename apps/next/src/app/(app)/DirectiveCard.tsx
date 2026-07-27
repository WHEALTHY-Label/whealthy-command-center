'use client';

import { useRef, useState } from 'react';
import { avatarInitial } from '@/lib/sidebar';
import { useRequestedPersonalization } from './PersonalizationProvider';
import { WelcomeConfetti } from './WelcomeConfetti';
import styles from './page.module.css';

/**
 * The Command Center welcome card: `#dashWelcomeCard` at index.html:2730.
 *
 * The live card was an avatar and a greeting on one row, a hairline, then the
 * Daily Directive under it, with a confetti canvas laid across the whole thing.
 * The port had the greeting and the directive but neither the steward's face
 * nor the celebration, and it carried a "Command Center" eyebrow the live card
 * never had. All three are settled here.
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
  avatarUrl,
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
  /** Already passed through `safeAvatarUrl`; null shows the initial. */
  avatarUrl: string | null;
}) {
  const { ai, greeting } = useRequestedPersonalization();
  const avatarRef = useRef<HTMLSpanElement>(null);
  const [photoBroken, setPhotoBroken] = useState(false);

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

  return (
    <section className={`${styles.card} ${styles.directiveCard}`}>
      <WelcomeConfetti originRef={avatarRef} />

      <div className={styles.welcomeRow}>
        {/* `#welcomeAvatarSlot` (2735): the ring pulses three times and stops,
            the photo lies over the initial so a broken CDN shows the letter. */}
        <span ref={avatarRef} className={styles.welcomeAvatar}>
          <span className={styles.welcomePulse} aria-hidden="true" />
          {avatarUrl && !photoBroken ? (
            /* eslint-disable-next-line @next/next/no-img-element -- a remote
               Skool CDN photo, sized by CSS; next/image would need a
               remotePatterns entry for a 44px decoration. */
            <img
              src={avatarUrl}
              alt=""
              className={styles.welcomePhoto}
              referrerPolicy="no-referrer"
              onError={() => setPhotoBroken(true)}
            />
          ) : null}
          <span aria-hidden="true">{avatarInitial(firstName)}</span>
        </span>

        {/* Server renders the hour-agnostic greeting so the hydrated tree
            matches, then the local hour refines it, then the model's own title
            replaces it. The model's title is rendered as text, where legacy
            assigned it to innerHTML: the same words, without handing a model's
            output the ability to write markup into the page. */}
        <h1 className={styles.name}>
          {aiTitle ?? (
            <>
              {greeting ?? 'Welcome back'}, <span className={styles.greetName}>{firstName}</span>!{' '}
              <span aria-hidden="true">👋</span>
            </>
          )}
        </h1>
      </div>

      <div className={styles.directiveRow}>
        <p className={styles.directiveLabel}>Daily Directive</p>
        <p className={styles.directive}>{line}</p>
      </div>
    </section>
  );
}
