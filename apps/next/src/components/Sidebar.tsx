'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TOUR_START_EVENT } from '@/components/tour/TourOverlay';
import { unseenAnswerCount } from '@/lib/actions/wall';
import { SIDEBAR_SECTIONS, avatarInitial, dayBadgeLabel, type SidebarBadge } from '@/lib/sidebar';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  isAdmin: boolean;
  /** Already resolved by `sidebarDisplayName` on the server. */
  displayName: string;
  /** Already passed through `safeAvatarUrl`; null renders the initial. */
  avatarUrl: string | null;
  /** `equipped` hides the Claim Bundle "New" badge, exactly as it did live. */
  productState: string;
  /** Day N of a running fast, or null. Drives the Fasting chip. */
  fastDay: number | null;
}

export function Sidebar({ isAdmin, displayName, avatarUrl, productState, fastDay }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [avatarBroken, setAvatarBroken] = useState(false);

  // `ME.recomputeBadges()` ran exactly once, right after `loadAndInit()` at
  // index.html:12527. The rail outlives client-side navigation, so mounting
  // once here is the same single call, not a per-page one.
  useEffect(() => {
    let alive = true;
    void unseenAnswerCount()
      .then((n) => {
        if (alive) setUnseen(n);
      })
      .catch(() => {
        /* a badge is not worth an error boundary */
      });
    return () => {
      alive = false;
    };
  }, []);

  const dayLabel = dayBadgeLabel(fastDay);
  const claimPending = productState !== 'equipped';

  const renderBadge = (badge: SidebarBadge | undefined) => {
    if (badge === 'claim') {
      // `updateClaimBadge()` at index.html:18328 showed the pulse only while
      // the steward was unequipped.
      if (!claimPending) return null;
      return (
        <span className={styles.claim}>
          <span className={styles.claimDot} aria-hidden="true" />
          <span className={styles.claimLabel}>New</span>
        </span>
      );
    }
    if (badge === 'fastDay') {
      // `updateNavBadge()` at index.html:16174 wrote 'DAY ' + activeFastDay().
      if (!dayLabel) return null;
      return <span className={styles.dayBadge}>{dayLabel}</span>;
    }
    if (badge === 'unseenPrayers') {
      if (unseen < 1) return null;
      return (
        <span
          className={styles.unseenDot}
          role="status"
          aria-label={`${unseen} answered ${unseen === 1 ? 'prayer' : 'prayers'} you have not seen`}
        />
      );
    }
    return null;
  };

  const renderLink = (
    item: { label: string; href: string; badge?: SidebarBadge },
    nested = false,
  ) => {
    const active = pathname === item.href;
    const highlight = item.badge === 'claim' && claimPending;
    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        // The guided tour finds its spotlight targets by destination.
        data-tour={item.href}
        className={[
          styles.link,
          nested ? styles.nested : '',
          active ? styles.active : '',
          highlight ? styles.claimHighlight : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-current={active ? 'page' : undefined}
      >
        <span>{item.label}</span>
        {renderBadge(item.badge)}
      </Link>
    );
  };

  return (
    <>
      <button
        type="button"
        className={styles.menuButton}
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.wordmark}>
          W<span className={styles.wordmarkAccent}>HEAL</span>THY
        </span>
        <span className={styles.menuIcon} aria-hidden="true">
          ☰
        </span>
      </button>

      <nav className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`} aria-label="Primary">
        <div className={styles.brand}>
          <span className={styles.wordmark}>
            W<span className={styles.wordmarkAccent}>HEAL</span>THY
          </span>
          <span className={styles.brandSub}>The Steward&apos;s Rhythm</span>
        </div>

        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.title} className={styles.section}>
            <p className={styles.sectionTitle}>{section.title}</p>
            {section.items.map((item) => (
              <div key={item.href + item.label}>
                {renderLink(item)}
                {item.children?.map((child) => (
                  <div key={child.href}>{renderLink(child, true)}</div>
                ))}
              </div>
            ))}
            {/* "Retake the Tour" sat at the bottom of the last section in the
                live rail. It has no destination: it re-opens the overlay that
                the app layout is already listening for. */}
            {section.title === 'More' ? (
              <button
                type="button"
                className={`${styles.link} ${styles.linkButton}`}
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
                }}
              >
                <span>Retake the Tour</span>
              </button>
            ) : null}
          </div>
        ))}

        {isAdmin ? (
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Admin</p>
            {renderLink({ label: 'Surface', href: '/admin' })}
            {renderLink({ label: 'Control Panel', href: '/admin/analytics' })}
          </div>
        ) : null}

        <div className={styles.footer}>
          <div className={styles.sidebarUser}>
            <span className={styles.avatar}>
              {avatarUrl && !avatarBroken ? (
                /* eslint-disable-next-line @next/next/no-img-element -- a remote
                   Skool CDN photo, sized by CSS; next/image would need a
                   remotePatterns entry for a 32px decoration. */
                <img
                  src={avatarUrl}
                  alt=""
                  className={styles.avatarPhoto}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarBroken(true)}
                />
              ) : null}
              <span aria-hidden="true">{avatarInitial(displayName)}</span>
            </span>
            <span className={styles.userText}>
              <span className={styles.userName}>{displayName}</span>
              {/* The live rail printed the literal word "Member" here, not the
                  steward's email address. */}
              <span className={styles.userRole}>Member</span>
            </span>
          </div>

          <form action="/auth/signout" method="post">
            <button type="submit" className={styles.signout}>
              ➜ Log Out
            </button>
          </form>
        </div>
      </nav>

      {open ? (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
