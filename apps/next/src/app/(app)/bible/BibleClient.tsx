'use client';

import { useState } from 'react';
import type { BibleMark, BibleProgress } from '@/lib/bible';
import { Bible365Panel } from './Bible365Panel';
import { MyBiblePanel } from './MyBiblePanel';
import styles from './bible.module.css';

export interface Spot {
  book: string;
  chapter: number;
  verse: number | null;
  mode: 'my_bible' | 'bible_365';
}

export function BibleClient({
  progress,
  spot,
  initialMarks,
  today,
}: {
  progress: BibleProgress | null;
  spot: Spot | null;
  initialMarks: BibleMark[];
  today: string;
}) {
  // The saved reader state remembers which mode the steward was in.
  const [mode, setMode] = useState<'365' | 'my'>(spot?.mode === 'my_bible' ? 'my' : '365');

  return (
    <>
      <div className={styles.modeToggle} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === '365'}
          className={mode === '365' ? styles.modeActive : styles.mode}
          onClick={() => setMode('365')}
        >
          Bible 365
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'my'}
          className={mode === 'my' ? styles.modeActive : styles.mode}
          onClick={() => setMode('my')}
        >
          My Bible
        </button>
      </div>

      {mode === '365' ? (
        <Bible365Panel progress={progress} today={today} />
      ) : (
        <MyBiblePanel spot={spot} initialMarks={initialMarks} />
      )}
    </>
  );
}
