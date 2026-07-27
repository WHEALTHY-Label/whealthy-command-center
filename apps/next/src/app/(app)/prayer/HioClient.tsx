'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HIO_CATEGORIES, hioCategory, type LedgerItem } from '@/lib/prayers';
import { answerLedgerPrayer, handOver } from '@/lib/actions/prayers';
import { fetchPassage } from '@/lib/actions/scripture';
import type { Passage } from '@/lib/bible';
import ui from '@/components/ui.module.css';
import styles from './prayer.module.css';

type Step = 'door' | 'name' | 'hand' | 'leave' | 'confirm';

export function HioClient({
  ledger,
  ledgerError,
  morning,
}: {
  ledger: LedgerItem[];
  /**
   * Why the ledger is empty when it is empty for a bad reason. Without this the
   * section prints "No weights handed over yet" over an expired session, which
   * tells a steward with a year of prayers that his record is blank.
   */
  ledgerError: string | null;
  morning: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('door');
  const [category, setCategory] = useState('freeform');
  const [weight, setWeight] = useState('');
  const [leave, setLeave] = useState<'private' | 'shared'>('private');
  const [postMode, setPostMode] = useState<'signed' | 'anonymous'>('signed');
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reader, setReader] = useState<Passage | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [answerFor, setAnswerFor] = useState<LedgerItem | null>(null);
  const [answerNote, setAnswerNote] = useState('');
  const [liftToTestimony, setLiftToTestimony] = useState(false);
  const [items, setItems] = useState(ledger);
  const [pending, startTransition] = useTransition();

  const cat = hioCategory(category);

  const toggleReader = () => {
    if (readerOpen) {
      setReaderOpen(false);
      return;
    }
    setReaderOpen(true);
    if (!reader) {
      // Pre-load the whole chapter around the promise verse.
      const chapterRef = cat.scriptureRef.split(':')[0] ?? cat.scriptureRef;
      startTransition(async () => {
        setReader(await fetchPassage(chapterRef));
      });
    }
  };

  const commit = () => {
    setError(null);
    startTransition(async () => {
      const result = await handOver(
        category,
        weight,
        leave === 'shared' ? { mode: postMode } : null,
      );
      if (!result.ok) {
        setError(result.error ?? 'That did not save.');
        return;
      }
      // A shared handover that the wall refused is still saved, so the flow
      // completes, but the confirmation has to say what actually happened
      // rather than promise a wall post that is not there.
      setShared(result.shared === true);
      setNotice(result.notice ?? null);
      setStep('confirm');
      router.refresh();
    });
  };

  const submitAnswer = () => {
    if (!answerFor) return;
    setError(null);
    startTransition(async () => {
      const result = await answerLedgerPrayer(answerFor.id, answerNote, liftToTestimony);
      if (!result.ok) {
        setError(result.error ?? 'That did not save.');
        return;
      }
      setItems((list) =>
        list.map((i) =>
          i.id === answerFor.id ? { ...i, status: 'answered' as const, outcome: answerNote } : i,
        ),
      );
      setAnswerFor(null);
      setAnswerNote('');
      setLiftToTestimony(false);
      router.refresh();
    });
  };

  const resetFlow = () => {
    setStep('door');
    setCategory('freeform');
    setWeight('');
    setLeave('private');
    setPostMode('signed');
    setReader(null);
    setReaderOpen(false);
    setError(null);
    setShared(false);
    setNotice(null);
  };

  const anchorVerse = Number(cat.scriptureRef.split(':')[1] ?? '0');

  return (
    <>
      {step === 'door' ? (
        <section className={ui.card}>
          <p className={ui.eyebrow}>Hand It Over</p>
          <h2 className={styles.headline}>What are you carrying?</h2>
          <p className={ui.body}>
            {morning
              ? 'Hand the day over before you carry it.'
              : "Don't take tonight's weight to bed."}
          </p>
          <div className={styles.doors}>
            {HIO_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                className={styles.door}
                onClick={() => {
                  setCategory(c.key);
                  setStep('name');
                }}
              >
                <span aria-hidden="true">{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
          <p className={ui.sub}>
            Everything you pray here is private by default and saved to My Prayers. Nothing goes on
            the community Prayer Wall unless you choose to put it there.
          </p>
        </section>
      ) : null}

      {step === 'name' ? (
        <section className={ui.card}>
          <p className={ui.eyebrow}>Name It · {cat.label}</p>
          <h2 className={styles.headline}>What&apos;s the weight?</h2>
          <input
            className={ui.input}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            maxLength={1000}
            placeholder="Name it in one simple line..."
          />
          {error ? <p className={ui.error}>{error}</p> : null}
          <div className={ui.row}>
            <button type="button" className={ui.quiet} onClick={() => setStep('door')}>
              Back
            </button>
            <button
              type="button"
              className={ui.primary}
              onClick={() => {
                if (!weight.trim()) {
                  setError('Please describe what you are carrying.');
                  return;
                }
                setError(null);
                setStep('hand');
              }}
            >
              Hand It Over
            </button>
          </div>
        </section>
      ) : null}

      {step === 'hand' ? (
        <section className={ui.card}>
          <p className={ui.eyebrow}>Hand It</p>
          <p className={styles.ledLine}>{cat.led}</p>
          <div className={styles.scriptureCard}>
            <p className={ui.kicker}>Scripture Promise · {cat.scriptureRef}</p>
            <p className={styles.scriptureText}>{cat.scriptureText}</p>
            <button type="button" className={ui.quiet} onClick={toggleReader}>
              {readerOpen ? '📖 Close the passage' : '📖 Read more · tap to open'}
            </button>
            {readerOpen ? (
              reader ? (
                <div className={styles.reader}>
                  {reader.verses.map((v) => (
                    <p
                      key={`${v.chapter}:${v.verse}`}
                      className={v.verse === anchorVerse ? styles.verseAnchor : styles.verse}
                    >
                      <span className={styles.verseNum}>{v.verse}</span> {v.text}
                    </p>
                  ))}
                </div>
              ) : (
                <p className={ui.sub}>Opening the passage…</p>
              )
            ) : null}
            <Link href="/bible" className={ui.link}>
              Open Scripture · read the full chapter
            </Link>
          </div>
          <button type="button" className={ui.primary} onClick={() => setStep('leave')}>
            Leave It Here
          </button>
        </section>
      ) : null}

      {step === 'leave' ? (
        <section className={ui.card}>
          <h2 className={styles.headline}>Where do you want to place this weight?</h2>
          <button
            type="button"
            className={leave === 'private' ? styles.choiceActive : styles.choice}
            onClick={() => setLeave('private')}
          >
            <span className={ui.pill}>Private</span>
            <span className={styles.choiceTitle}>Leave it here</span>
            <span className={ui.sub}>
              Saved to My Prayers. Only you can ever see it. Nothing is posted anywhere.
            </span>
          </button>
          <button
            type="button"
            className={leave === 'shared' ? styles.choiceActive : styles.choice}
            onClick={() => setLeave('shared')}
          >
            <span className={ui.pillLime}>Shared</span>
            <span className={styles.choiceTitle}>Lift it to the Prayer Wall</span>
            <span className={ui.sub}>
              Posts this prayer to the community Prayer Wall. Other stewards will see it and can tap
              &quot;I prayed&quot; for you. You can take it down anytime.
            </span>
          </button>
          {leave === 'shared' ? (
            <div className={ui.row} role="radiogroup" aria-label="How to post">
              <label className={styles.modeChoice}>
                <input
                  type="radio"
                  name="hio-post-mode"
                  checked={postMode === 'signed'}
                  onChange={() => setPostMode('signed')}
                />
                Post signed
              </label>
              <label className={styles.modeChoice}>
                <input
                  type="radio"
                  name="hio-post-mode"
                  checked={postMode === 'anonymous'}
                  onChange={() => setPostMode('anonymous')}
                />
                Post anonymously
              </label>
            </div>
          ) : null}
          {error ? <p className={ui.error}>{error}</p> : null}
          <div className={ui.row}>
            <button type="button" className={ui.quiet} onClick={() => setStep('hand')}>
              Back
            </button>
            <button type="button" className={ui.primary} disabled={pending} onClick={commit}>
              {pending ? 'Placing it…' : 'Confirm'}
            </button>
          </div>
        </section>
      ) : null}

      {step === 'confirm' ? (
        <section className={ui.cardLime}>
          <p className={styles.dove} aria-hidden="true">
            🕊️
          </p>
          <h2 className={styles.headline}>{shared ? 'Lifted to the Wall' : 'Saved Privately'}</h2>
          <p className={ui.body}>
            {notice
              ? notice
              : shared
                ? 'Your prayer is now on the Prayer Wall where other stewards can see it and pray for you. A copy lives in My Prayers.'
                : 'Saved privately to My Prayers. No one else will ever see it. Just you and Him.'}
          </p>
          <div className={ui.row}>
            <button type="button" className={ui.primary} onClick={resetFlow}>
              Hand Another Weight Over
            </button>
            <Link href="/bible" className={ui.link}>
              Keep reading in My Bible →
            </Link>
          </div>
        </section>
      ) : null}

      <section className={ui.card}>
        <p className={ui.kicker}>The weights you&apos;ve handed over</p>
        {ledgerError && items.length === 0 ? (
          <p className={ui.error}>{ledgerError}</p>
        ) : items.length === 0 ? (
          <p className={ui.sub}>No weights handed over yet. Let Him carry the weight.</p>
        ) : (
          <ul className={styles.ledger}>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={styles.ledgerRow}
                  onClick={() => {
                    if (item.status === 'answered') return;
                    setAnswerFor(item);
                    setAnswerNote('');
                  }}
                >
                  <span className={styles.ledgerBody}>{item.body}</span>
                  <span className={ui.sub}>
                    {item.category.toUpperCase()}
                    {item.createdAt
                      ? ` · ${new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : ''}
                  </span>
                  <span
                    className={
                      item.status === 'answered'
                        ? ui.pillGreen
                        : item.status === 'lifted'
                          ? ui.pillLime
                          : ui.pill
                    }
                  >
                    {item.status === 'answered'
                      ? 'Answered'
                      : item.status === 'lifted'
                        ? `Lifted (${item.prayCount})`
                        : 'Private'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {answerFor ? (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Did He Answer?">
          <div className={styles.modalCard}>
            <p className={styles.modalTitle}>Did He Answer?</p>
            <textarea
              className={ui.textarea}
              value={answerNote}
              onChange={(e) => setAnswerNote(e.target.value)}
              maxLength={1000}
              placeholder="Tell the story... How did He respond to this weight?"
            />
            <label className={styles.modeChoice}>
              <input
                type="checkbox"
                checked={liftToTestimony}
                onChange={(e) => setLiftToTestimony(e.target.checked)}
              />
              Lift this answer to the Testimony Wall
            </label>
            {error ? <p className={ui.error}>{error}</p> : null}
            <div className={ui.row}>
              <button
                type="button"
                className={ui.primary}
                disabled={pending || !answerNote.trim()}
                onClick={submitAnswer}
              >
                Save Answer
              </button>
              <button
                type="button"
                className={ui.quiet}
                onClick={() => {
                  setAnswerFor(null);
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
