import styles from './NavFrame.module.css';

/**
 * Top-level navigation frame for authenticated members.
 *
 * Mirrors the recovered app's primary sections as labels only. Real routing
 * targets arrive in later slices (the sections themselves in Slices 3-8).
 * The sign-out control is live.
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
        <form action="/auth/signout" method="post" className={styles.signout}>
          <button type="submit" className={styles.signoutButton}>
            Sign out
          </button>
        </form>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>The Steward&rsquo;s Rhythm, migration preview</footer>
    </div>
  );
}
