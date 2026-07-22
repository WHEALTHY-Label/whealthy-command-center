import styles from './NavFrame.module.css';

/**
 * Top-level navigation frame placeholder.
 *
 * Mirrors the recovered app's primary sections as labels only. Real routing
 * targets and gating arrive in later slices (auth in Slice 2, the sections
 * themselves in Slices 3-8). Nothing here navigates yet.
 */
const SECTIONS = ['Dashboard', 'Rhythm', 'Bible', 'Prayer', 'Wall', 'Portal', 'Admin'] as const;

export function NavFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.wordmark}>WHEALTHY</span>
        <nav aria-label="Primary" className={styles.nav}>
          {SECTIONS.map((label) => (
            <span key={label} className={styles.navItem} aria-disabled="true">
              {label}
            </span>
          ))}
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>The Steward&rsquo;s Rhythm — migration preview</footer>
    </div>
  );
}
