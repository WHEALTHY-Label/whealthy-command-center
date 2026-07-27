'use client';

import { useEffect, useState, useTransition } from 'react';
import { fetchPassage } from '@/lib/actions/scripture';
import type { Passage } from '@/lib/bible';
import styles from './wizard.module.css';

/**
 * A row of tappable scripture references, matching the live app where every
 * ref in the builder and the reveal opens the passage in place. The reader is
 * a bottom sheet on a phone so the text lands under the thumb.
 */
export function ScriptureRefs({
  refs,
  className,
}: {
  refs: string[];
  className?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [pending, startTransition] = useTransition();

  // Escape closes the reader, the same as tapping the backdrop.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const show = (ref: string) => {
    setOpen(ref);
    setPassage(null);
    startTransition(async () => {
      setPassage(await fetchPassage(ref));
    });
  };

  if (refs.length === 0) return null;

  return (
    <>
      <div className={className ? `${styles.refRow} ${className}` : styles.refRow}>
        {refs.map((r) => (
          <button key={r} type="button" className={styles.ref} onClick={() => show(r)}>
            {r}
          </button>
        ))}
      </div>
      {open ? (
        <div
          className={styles.sheet}
          role="dialog"
          aria-modal="true"
          aria-label={open}
          onClick={() => setOpen(null)}
        >
          <div className={styles.sheetCard} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.sheetTitle}>{passage?.reference || open}</h2>
            {pending && !passage ? <p className={styles.verse}>Opening the passage...</p> : null}
            {!pending && !passage ? (
              <p className={styles.verse}>
                That passage did not load. Open it in your Bible and come back.
              </p>
            ) : null}
            {passage?.verses.map((v) => (
              <p key={`${v.chapter}:${v.verse}`} className={styles.verse}>
                <span className={styles.verseNum}>{v.verse}</span>
                {v.text}
              </p>
            ))}
            <button type="button" className={styles.addBtn} onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
