import styles from './page.module.css';

export default function HomePage() {
  return (
    <section className={styles.hero}>
      <p className={styles.kicker}>Slice 2, Authentication &amp; Session Boundary</p>
      <h1 className={styles.title}>The Steward&rsquo;s Rhythm</h1>
      <p className={styles.lede}>
        You are signed in as an approved member. This protected home sits behind the real session
        boundary: a one-time code login, server-validated sessions, and the Stewards membership
        gate. The feature pages migrate in later slices; the live application remains on the static
        baseline until final cutover approval.
      </p>
      <p className={styles.baseline}>Baseline: production-baseline-2026-07-21</p>
    </section>
  );
}
