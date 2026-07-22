import styles from './ComingSoon.module.css';

/** Placeholder for a route whose feature migrates in a later slice. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className={styles.wrap}>
      <p className={styles.eyebrow}>Coming in a later slice</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.body}>
        This part of the app hasn&rsquo;t been migrated yet. The live application still has it, and
        it arrives here in an upcoming slice.
      </p>
    </div>
  );
}
