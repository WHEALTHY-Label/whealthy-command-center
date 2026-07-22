import styles from '../page.module.css';

export default function QuizPage() {
  return (
    <section className={styles.hero}>
      <p className={styles.kicker}>Next step</p>
      <h1 className={styles.title}>Your assessment</h1>
      <p className={styles.lede}>
        You are a member, and your next step is the pattern assessment. The assessment itself
        migrates in a later slice; this placeholder confirms the membership gate routed you here.
      </p>
    </section>
  );
}
