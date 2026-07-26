'use client';

import { useState, useTransition } from 'react';
import { AFFILIATE_TARGETS, affiliateUrl } from '@/lib/catalog';
import { registerAffiliate } from './actions';
import ui from '@/components/ui.module.css';
import styles from './affiliate.module.css';

export function AffiliateClient({ initialRefId }: { initialRefId: string | null }) {
  const [refId, setRefId] = useState(initialRefId);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await registerAffiliate(link);
      if (!result.ok) {
        setError(result.error ?? 'That did not save.');
        return;
      }
      setRefId(result.refId ?? null);
      setSaved(true);
    });
  };

  const copy = async (index: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(index);
      setTimeout(() => setCopied((c) => (c === index ? null : c)), 2000);
    } catch {
      setError('Copy failed. Long-press the link to copy it.');
    }
  };

  return (
    <>
      <section className={ui.card}>
        <p className={ui.kicker}>Your ID</p>
        <p className={ui.body}>Paste your Skool invite link below to get your ID.</p>
        <input
          className={ui.input}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://www.skool.com/bakndcreator/about?ref=..."
          inputMode="url"
          autoComplete="off"
        />
        <div className={ui.row}>
          <button type="button" className={ui.primary} onClick={generate} disabled={pending}>
            {pending ? 'Generating…' : 'Generate links'}
          </button>
          {refId ? <span className={ui.pillLime}>ref: {refId}</span> : null}
        </div>
        {error ? <p className={ui.error}>{error}</p> : null}
        {saved ? <p className={ui.good}>Links generated successfully!</p> : null}
      </section>

      {refId ? (
        <section className={ui.card}>
          <p className={ui.kicker}>Your funnel links</p>
          <ul className={styles.targets}>
            {AFFILIATE_TARGETS.map((t, i) => {
              const url = affiliateUrl(t.path, refId);
              return (
                <li key={t.path} className={styles.target}>
                  <div className={styles.targetBody}>
                    <span className={styles.targetName}>{t.name}</span>
                    <span className={ui.sub}>{t.pitch}</span>
                    <span className={styles.targetUrl}>{url}</span>
                  </div>
                  <button type="button" className={ui.quiet} onClick={() => void copy(i, url)}>
                    {copied === i ? 'Copied!' : 'Copy'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
