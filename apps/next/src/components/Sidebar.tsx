'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

interface NavItem {
  label: string;
  href: string;
  live?: boolean;
  children?: { label: string; href: string }[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Structure and labels preserved from the live app's three-section sidebar.
// Only Home is migrated; the rest route to a "coming soon" placeholder until
// their slices land.
const SECTIONS: NavSection[] = [
  {
    title: 'General',
    items: [
      { label: 'Home', href: '/', live: true },
      { label: 'Claim Bundle', href: '/claim' },
      { label: 'Try All', href: '/tryall' },
      { label: 'The Record', href: '/record' },
    ],
  },
  {
    title: 'Disciplines',
    items: [
      {
        label: 'Prayer',
        href: '/prayer',
        children: [
          { label: 'Prayer Wall', href: '/wall' },
          { label: 'Testimony Wall', href: '/testimony' },
          { label: 'My Prayers', href: '/me' },
        ],
      },
      { label: 'Scripture', href: '/bible' },
      {
        label: 'Fasting',
        href: '/fast',
        children: [
          { label: 'The Fast', href: '/fast' },
          { label: 'Cohort Challenge', href: '/cohort' },
        ],
      },
      { label: 'Circles', href: '/circle' },
    ],
  },
  {
    title: 'Community and More',
    items: [
      { label: 'Community', href: '/community' },
      { label: 'Affiliate Center', href: '/affiliate' },
      { label: 'Product Portal', href: '/portal' },
    ],
  },
];

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const renderLink = (item: { label: string; href: string; live?: boolean }, nested = false) => {
    const active = pathname === item.href;
    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        className={`${styles.link} ${nested ? styles.nested : ''} ${active ? styles.active : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <span>{item.label}</span>
        {item.live ? null : <span className={styles.soon}>soon</span>}
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
        <span className={styles.wordmark}>WHEALTHY</span>
        <span className={styles.menuIcon} aria-hidden="true">
          ☰
        </span>
      </button>

      <nav className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`} aria-label="Primary">
        <div className={styles.brand}>
          <span className={styles.wordmark}>WHEALTHY</span>
        </div>

        {SECTIONS.map((section) => (
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
          </div>
        ))}

        {isAdmin ? (
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Admin</p>
            {renderLink({ label: 'Control Center', href: '/admin' })}
          </div>
        ) : null}

        <form action="/auth/signout" method="post" className={styles.footer}>
          <button type="submit" className={styles.signout}>
            Sign out
          </button>
        </form>
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
