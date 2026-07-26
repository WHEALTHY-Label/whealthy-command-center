import Link from 'next/link';
import styles from './assess.module.css';

/**
 * A threshold, not a locked door. If the Genius Quiz has not been taken, the
 * rhythm has nothing to be built on, so we say so plainly and point at the
 * quiz. No skip, no countdown, no shame.
 */
export function SeasonThreshold() {
  return (
    <div className={styles.threshold}>
      <p className={styles.eyebrow}>The Steward&rsquo;s Rhythm</p>
      <h1 className={styles.thresholdTitle}>First, your season</h1>
      <p className={styles.sub}>
        A rhythm that fits you has to be built on you. Take the 3-minute Genius Quiz so we know your
        season, then we build it together.
      </p>
      <Link href="/quiz" className={styles.primary}>
        Begin
      </Link>
      <p className={styles.verse}>
        &ldquo;Let all things be done decently and in order.&rdquo; &mdash; 1 Corinthians 14:40
      </p>
    </div>
  );
}
