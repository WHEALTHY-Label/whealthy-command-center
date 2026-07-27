'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { day365, type BibleProgress, type Passage } from '@/lib/bible';
import type { WallPost } from '@/lib/wall';
import { READINGS } from '@/lib/data/readings365';
import { fetchPassage } from '@/lib/actions/scripture';
import { SanctuaryPrayer } from './SanctuaryPrayer';
import {
  begin365,
  checkWordArrives,
  saveReflection,
  toggle365Day,
  type WordResult,
} from './actions';
import ui from '@/components/ui.module.css';
import styles from './bible.module.css';

export function Bible365Panel({
  progress,
  today,
  prayerFeed,
  prayerFeedError,
  broughtPrayerToday,
}: {
  progress: BibleProgress | null;
  today: string;
  prayerFeed: WallPost[];
  /** Why the sanctuary prayer feed is empty. Forwarded from the server read. */
  prayerFeedError: string | null;
  broughtPrayerToday: boolean;
}) {
  const router = useRouter();
  const currentDay = progress ? day365(progress.startDate, today) : 1;
  const [viewDay, setViewDay] = useState(currentDay);
  const [startDate, setStartDate] = useState(today);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [reflectOpen, setReflectOpen] = useState(false);
  const [said, setSaid] = useState('');
  const [willDo, setWillDo] = useState('');
  const [share, setShare] = useState(false);
  const [saved, setSaved] = useState(false);
  const [word, setWord] = useState<WordResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!progress) {
    return (
      <section className={ui.cardLime}>
        <p className={ui.kicker}>365-Day Bible Study</p>
        <p className={ui.body}>
          Read through the entire Bible in one year, starting any day you choose. Your Day 1 is the
          day you start, and the calendar moves whether you read or not. Grace covers the gaps.
        </p>
        <label className={ui.sub} htmlFor="b365-start">
          Choose your start date
        </label>
        <input
          id="b365-start"
          type="date"
          className={ui.input}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <button
          type="button"
          className={ui.primary}
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await begin365(startDate);
              if (!result.ok) setError(result.error ?? 'That did not save.');
              else router.refresh();
            });
          }}
        >
          Begin
        </button>
        {error ? <p className={ui.error}>{error}</p> : null}
      </section>
    );
  }

  const reading = READINGS[viewDay - 1] ?? READINGS[0]!;
  const done = progress.completed.includes(viewDay);
  const streak = progress.streak;

  const openReader = () => {
    if (readerOpen) {
      setReaderOpen(false);
      return;
    }
    setReaderOpen(true);
    setPassage(null);
    startTransition(async () => {
      setPassage(await fetchPassage(reading.ref));
    });
  };

  const afterKeptDay = () => {
    // A kept reading is the legacy trigger for word-arrives; the function
    // gates itself (kept day, cadence, weekly cap) and is idempotent today.
    startTransition(async () => {
      const result = await checkWordArrives();
      if (result.arrived) setWord(result);
    });
  };

  return (
    <>
      <section className={ui.cardLime}>
        <div className={ui.row}>
          <button
            type="button"
            className={ui.quiet}
            aria-label="Previous day"
            disabled={viewDay <= 1}
            onClick={() => {
              setViewDay((d) => Math.max(1, d - 1));
              setReaderOpen(false);
            }}
          >
            ←
          </button>
          <div className={styles.heroCenter}>
            <p className={ui.kicker}>
              Week {reading.week} · Day {reading.day}
              {reading.theme ? ` · ${reading.theme}` : ''}
            </p>
            <h2 className={styles.heroRef}>{reading.ref}</h2>
            <p className={ui.sub}>{reading.title}</p>
          </div>
          <button
            type="button"
            className={ui.quiet}
            aria-label="Next day"
            disabled={viewDay >= 365}
            onClick={() => {
              setViewDay((d) => Math.min(365, d + 1));
              setReaderOpen(false);
            }}
          >
            →
          </button>
        </div>
        {viewDay !== currentDay ? (
          <button type="button" className={ui.link} onClick={() => setViewDay(currentDay)}>
            Back to today (Day {currentDay})
          </button>
        ) : null}
        <div className={ui.row}>
          <button type="button" className={ui.primary} onClick={openReader}>
            {readerOpen ? 'Close the passage' : 'Read full passage'}
          </button>
          <button
            type="button"
            className={done ? ui.chipActive : ui.chip}
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await toggle365Day(viewDay, currentDay);
                if (!result.ok) {
                  setError(result.error ?? 'That did not save.');
                  return;
                }
                router.refresh();
                if (!done) afterKeptDay();
              });
            }}
          >
            {done ? '✓ Reading kept' : 'Mark reading complete'}
          </button>
          <button type="button" className={ui.quiet} onClick={() => setReflectOpen((v) => !v)}>
            Reflect
          </button>
        </div>
        {error ? <p className={ui.error}>{error}</p> : null}
        {readerOpen ? (
          passage ? (
            <div className={styles.reader}>
              {passage.verses.map((v) => (
                <p key={`${v.book}-${v.chapter}-${v.verse}`} className={styles.verse}>
                  <span className={styles.verseNum}>
                    {v.chapter}:{v.verse}
                  </span>{' '}
                  {v.text}
                </p>
              ))}
            </div>
          ) : (
            <p className={ui.sub}>Opening {reading.ref}…</p>
          )
        ) : null}
      </section>

      {word?.arrived ? (
        <section className={ui.cardLime}>
          <p className={ui.kicker}>A word arrived</p>
          {word.reference ? <p className={styles.heroRef}>{word.reference}</p> : null}
          {word.text ? <p className={ui.body}>{word.text}</p> : null}
          <p className={ui.sub}>Chosen for you.</p>
        </section>
      ) : null}

      <section className={ui.card}>
        <p className={ui.kicker}>Steady Journey</p>
        <div className={ui.row}>
          <span className={ui.statValue}>{streak}</span>
          <span className={ui.sub}>
            day{streak === 1 ? '' : 's'} in a row · {progress.completed.length} of 365 readings kept
          </span>
        </div>
        <div className={ui.meterTrack} aria-hidden="true">
          <div
            className={ui.meterFill}
            style={{ width: `${Math.round((progress.completed.length / 365) * 100)}%` }}
          />
        </div>
      </section>

      {reflectOpen ? (
        <section className={ui.card}>
          <p className={ui.kicker}>Reflection journaling</p>
          {saved ? (
            <p className={ui.good}>Reflection saved.</p>
          ) : (
            <>
              <label className={ui.sub} htmlFor="b365-said">
                What does it say?
              </label>
              <textarea
                id="b365-said"
                className={ui.textarea}
                value={said}
                onChange={(e) => setSaid(e.target.value)}
                maxLength={2000}
              />
              <label className={ui.sub} htmlFor="b365-willdo">
                What will you do?
              </label>
              <textarea
                id="b365-willdo"
                className={ui.textarea}
                value={willDo}
                onChange={(e) => setWillDo(e.target.value)}
                maxLength={2000}
              />
              <label className={styles.checkLine}>
                <input
                  type="checkbox"
                  checked={share}
                  onChange={(e) => setShare(e.target.checked)}
                />
                Share reflections privately with WHEALTHY to personalize your walk
              </label>
              <button
                type="button"
                className={ui.primary}
                disabled={pending || (!said.trim() && !willDo.trim())}
                onClick={() => {
                  startTransition(async () => {
                    const result = await saveReflection(viewDay, reading.ref, said, willDo, share);
                    if (!result.ok) {
                      setError(result.error ?? 'That did not save.');
                      return;
                    }
                    setSaved(true);
                    afterKeptDay();
                  });
                }}
              >
                Save reflection
              </button>
            </>
          )}
        </section>
      ) : null}

      <SanctuaryPrayer
        broughtToday={broughtPrayerToday}
        initialFeed={prayerFeed}
        initialFeedError={prayerFeedError}
      />
    </>
  );
}
