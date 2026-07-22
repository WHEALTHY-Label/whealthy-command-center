import { NavFrame } from '@/components/NavFrame';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <NavFrame>
      <section className={styles.hero}>
        <p className={styles.kicker}>Slice 1 — Shell &amp; Preview Environment</p>
        <h1 className={styles.title}>The Steward&rsquo;s Rhythm</h1>
        <p className={styles.lede}>
          This is the Next.js migration shell. The global frame, design tokens, fonts, and error and
          loading boundaries are in place. Feature behavior migrates in later slices; the live
          application remains on the static baseline until final cutover approval.
        </p>
        <p className={styles.baseline}>Baseline: production-baseline-2026-07-21</p>
      </section>
    </NavFrame>
  );
}
