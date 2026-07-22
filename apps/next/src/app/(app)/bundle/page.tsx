import styles from '../page.module.css';

export default function BundlePage() {
  return (
    <section className={styles.hero}>
      <p className={styles.kicker}>Next step</p>
      <h1 className={styles.title}>Your monthly bundle</h1>
      <p className={styles.lede}>
        Your assessment is done. Setting up your bundle is the next step. The bundle flow migrates
        in a later slice; this placeholder confirms the membership gate routed you here.
      </p>
    </section>
  );
}
