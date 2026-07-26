'use client';

import { useState } from 'react';
import Link from 'next/link';
import ui from '@/components/ui.module.css';
import styles from './tryall.module.css';

export function CodeBanner({ code, discount }: { code: string | null; discount: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setRevealed(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setRevealed(true);
    }
  };

  return (
    <section className={ui.cardLime}>
      <p className={ui.kicker}>Member pricing, every time</p>
      <div className={ui.row}>
        <span className={styles.code}>{revealed || copied ? code : '••••••'}</span>
        <button type="button" className={ui.primary} onClick={() => void copy()}>
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>
      <p className={ui.body}>
        {discount} off every product, every time. Yours as long as you&apos;re a Steward.
      </p>
      {copied ? (
        <div className={ui.row}>
          <span className={ui.good}>Code copied! Ready to govern your energy?</span>
          <Link href="/claim" className={ui.quiet}>
            Claim your monthly bundle
          </Link>
        </div>
      ) : null}
    </section>
  );
}
