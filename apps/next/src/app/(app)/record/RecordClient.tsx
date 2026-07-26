'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  burnRecordEntry,
  fileJournalEntry,
  readThreads,
  type ScribeResult,
  type Thread,
} from './actions';
import ui from '@/components/ui.module.css';
import styles from './record.module.css';

export interface RecordEntry {
  entryDate: string;
  text: string;
  tone: 'heavy' | 'win' | 'mixed';
  scribeLine: string | null;
  fastDay: number | null;
  burned: boolean;
}

export function RecordClient({
  entries,
  fastChip,
  fastId,
  fastDay,
}: {
  entries: RecordEntry[];
  fastChip: string | null;
  fastId: string | null;
  fastDay: number | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [kept, setKept] = useState<{ scribe: ScribeResult | null; offline: boolean } | null>(null);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [burnArmed, setBurnArmed] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [observation, setObservation] = useState('');
  const [pending, startTransition] = useTransition();

  const live = entries.filter((e) => !e.burned);

  const file = () => {
    setError(null);
    startTransition(async () => {
      const result = await fileJournalEntry(
        draft,
        new Date().getTimezoneOffset(),
        fastId,
        fastDay,
      );
      if (!result.ok) {
        setError(result.error ?? 'That did not save.');
        return;
      }
      setKept({ scribe: result.scribe ?? null, offline: result.offline === true });
      setDraft('');
      router.refresh();
    });
  };

  const burn = (entryDate: string) => {
    if (burnArmed !== entryDate) {
      setBurnArmed(entryDate);
      setTimeout(() => setBurnArmed((b) => (b === entryDate ? null : b)), 5000);
      return;
    }
    setBurnArmed(null);
    startTransition(async () => {
      const result = await burnRecordEntry(entryDate);
      if (!result.ok) setError(result.error ?? 'That did not save.');
      else router.refresh();
    });
  };

  const map = () => {
    startTransition(async () => {
      const result = await readThreads(live.map((e) => e.text));
      if (result.ok) {
        setThreads(result.threads);
        setObservation(result.observation);
      }
    });
  };

  return (
    <>
      <section className={ui.card}>
        <div className={ui.row}>
          <p className={ui.kicker}>Tonight&apos;s Entry</p>
          {fastChip ? <span className={ui.pillLime}>{fastChip}</span> : null}
        </div>
        <p className={ui.body}>
          Hold nothing back. Two minutes, honest. The scribe keeps your words exactly as you said
          them.
        </p>
        <p className={styles.officeLine}>
          <strong>What held.</strong> What slipped. <strong>What carries into tomorrow.</strong>
        </p>
        {kept ? (
          <div className={styles.keptBlock}>
            <span className={ui.pillGreen}>Entry Kept{fastDay ? ` · Day ${fastDay}` : ''}</span>
            {kept.offline ? (
              <p className={ui.sub}>
                Entry kept. The scribe could not read it right now, so it holds your words as they
                are. They are safe.
              </p>
            ) : kept.scribe ? (
              <>
                {kept.scribe.scribeLine ? (
                  <p className={styles.scribeLine}>{kept.scribe.scribeLine}</p>
                ) : null}
                <div className={ui.chipRow}>
                  {kept.scribe.people.map((p) => (
                    <span key={`p-${p}`} className={ui.pill}>
                      {p}
                    </span>
                  ))}
                  {kept.scribe.burdens.map((b) => (
                    <span key={`b-${b}`} className={ui.pillAmber}>
                      {b}
                    </span>
                  ))}
                  {kept.scribe.wins.map((w) => (
                    <span key={`w-${w}`} className={ui.pillGreen}>
                      {w}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
            <button type="button" className={ui.quiet} onClick={() => setKept(null)}>
              New entry
            </button>
          </div>
        ) : (
          <>
            <textarea
              className={ui.textarea}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={8000}
              placeholder="Your words land here. Edit anything, they stay yours."
            />
            {error ? <p className={ui.error}>{error}</p> : null}
            <button
              type="button"
              className={ui.primary}
              disabled={pending || !draft.trim()}
              onClick={file}
            >
              {pending ? 'The scribe is keeping your words…' : "File Tonight's Entry"}
            </button>
          </>
        )}
      </section>

      <section className={ui.card}>
        <p className={ui.kicker}>The Threads</p>
        <p className={ui.body}>
          The scribe tracks what keeps returning: the people, the burdens, the wins. It names the
          pattern. It never interprets your heart.
        </p>
        {live.length < 3 ? (
          <p className={ui.sub}>
            The map draws itself from your entries. Three entries in, the first thread appears.
          </p>
        ) : threads === null ? (
          <button type="button" className={ui.quiet} disabled={pending} onClick={map}>
            {pending ? 'Reading the map…' : 'Read the Map'}
          </button>
        ) : (
          <>
            {threads.map((t) => (
              <div key={t.name} className={styles.threadRow}>
                <span className={styles.threadCount}>{t.count}</span>
                <div className={styles.threadBody}>
                  <span className={styles.threadName}>
                    {t.name}{' '}
                    <span
                      className={
                        t.weight === 'heavy'
                          ? ui.pillAmber
                          : t.weight === 'turning'
                            ? ui.pillGreen
                            : ui.pill
                      }
                    >
                      {t.weight}
                    </span>
                  </span>
                  {t.line ? <span className={ui.sub}>{t.line}</span> : null}
                </div>
              </div>
            ))}
            {observation ? <p className={styles.observation}>{observation}</p> : null}
            <button type="button" className={ui.quiet} disabled={pending} onClick={map}>
              Reread the Map
            </button>
          </>
        )}
      </section>

      <section className={ui.card}>
        <p className={ui.kicker}>The Wall</p>
        <p className={ui.body}>
          Every entry, a stone laid. Amber held weight. Lime held a win. Tap any stone to read it.
        </p>
        {live.length === 0 ? (
          <p className={ui.sub}>The first stone is one entry away.</p>
        ) : (
          <ul className={styles.stones}>
            {live.map((e) => (
              <li key={e.entryDate}>
                <button
                  type="button"
                  className={`${styles.stone} ${e.tone === 'heavy' ? styles.stoneHeavy : e.tone === 'win' ? styles.stoneWin : ''}`}
                  onClick={() => setOpenDate((d) => (d === e.entryDate ? null : e.entryDate))}
                  aria-expanded={openDate === e.entryDate}
                >
                  <span className={styles.stoneDate}>
                    {new Date(`${e.entryDate}T12:00:00Z`).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {e.fastDay ? ` · Day ${e.fastDay}` : ''}
                  </span>
                  {openDate === e.entryDate ? (
                    <span className={styles.stoneFull}>
                      <span className={styles.stoneQuote}>{e.text}</span>
                      {e.scribeLine ? <span className={ui.sub}>{e.scribeLine}</span> : null}
                    </span>
                  ) : (
                    <span className={styles.stonePeek}>{e.text.slice(0, 80)}</span>
                  )}
                </button>
                {openDate === e.entryDate ? (
                  <div className={ui.row}>
                    <button
                      type="button"
                      className={ui.danger}
                      disabled={pending}
                      onClick={() => burn(e.entryDate)}
                    >
                      {burnArmed === e.entryDate ? 'Confirm burn — gone everywhere' : 'Burn this entry'}
                    </button>
                    {burnArmed === e.entryDate ? (
                      <button type="button" className={ui.quiet} onClick={() => setBurnArmed(null)}>
                        Keep it
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className={ui.sub}>
          {live.length} entr{live.length === 1 ? 'y' : 'ies'} in your journal. At year end, the
          journal becomes a printed book.
        </p>
      </section>

      <section className={ui.card}>
        <p className={ui.kicker}>Covenant of the Record</p>
        <p className={ui.body}>
          What is remembered: your entries, the threads the scribe names, and what your fasts
          showed.
        </p>
        <p className={ui.body}>
          What is never shared: your words. Not with your brother, not with the community, not with
          anyone.
        </p>
        <p className={ui.body}>
          What you control: burn any entry from The Wall. Burned means gone, everywhere, including
          from what the scribe learns.
        </p>
      </section>
    </>
  );
}
