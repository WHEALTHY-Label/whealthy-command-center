import styles from './DrumLoader.module.css';

/**
 * The drum from the original builder: two sticks keeping time on a shell while
 * the engine works. It is a status region rather than decoration, so a screen
 * reader hears the label instead of nothing at all.
 */
export function DrumLoader({ label }: { label: string }) {
  return (
    <div className={styles.loader} role="status" aria-live="polite">
      <svg className={styles.drum} viewBox="0 0 80 80" aria-hidden="true" focusable="false">
        <line
          className={styles.stickLeft}
          x1="20"
          y1="20"
          x2="38"
          y2="48"
          strokeLinecap="round"
        />
        <line
          className={styles.stickRight}
          x1="60"
          y1="20"
          x2="42"
          y2="48"
          strokeLinecap="round"
        />
        <ellipse className={styles.shell} cx="40" cy="54" rx="22" ry="12" />
        <ellipse className={styles.head} cx="40" cy="46" rx="22" ry="6" />
        <line className={styles.rim} x1="18" y1="46" x2="18" y2="54" />
        <line className={styles.rim} x1="62" y1="46" x2="62" y2="54" />
      </svg>
      <p className={styles.label}>{label}</p>
    </div>
  );
}
