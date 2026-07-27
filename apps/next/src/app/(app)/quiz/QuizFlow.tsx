'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  canAdvance,
  PATTERN_REVEAL,
  PEAK_BLOCKS,
  QUIZ_QUESTIONS,
  screenChrome,
  type QuizAnswers,
  type QuizScore,
} from '@/lib/quiz';
import { submitQuiz } from './actions';
import styles from './quiz.module.css';

/**
 * The Steward Pattern assessment, eleven screens.
 *
 * The client holds raw answers only. It never scores, so the pattern and
 * bundle it displays are the ones the server returned, not ones it derived.
 * That is the whole reason `submitQuiz` echoes the score back.
 */

const LOAD_SEASON_LABEL: Readonly<Record<string, string>> = {
  building: 'Building',
  carrying: 'Carrying',
  stacked: 'Stacked',
};

const IDENTITY_LABEL: Readonly<Record<string, string>> = {
  operator: 'The Operator',
  anchor: 'The Anchor',
  provider: 'The Provider',
  'long-haul': 'The Long Haul',
  builder: 'The Builder',
  'quiet-carrier': 'The Quiet Carrier',
};

const PEAK_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
  PEAK_BLOCKS.map((b) => [b.value, b.label]),
);

interface Settled {
  score: QuizScore;
  bundleName: string;
  invited: boolean;
}

export function QuizFlow({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [pending, startTransition] = useTransition();

  const patch = useCallback((next: Partial<QuizAnswers>) => {
    setAnswers((a) => ({ ...a, ...next }));
  }, []);

  const chrome = useMemo(() => screenChrome(step), [step]);
  const question = QUIZ_QUESTIONS[step];
  const ready = canAdvance(step, answers);
  const last = step === QUIZ_QUESTIONS.length - 1;

  const advance = useCallback(() => {
    setError(null);
    if (!last) {
      setStep((s) => Math.min(s + 1, QUIZ_QUESTIONS.length - 1));
      return;
    }
    startTransition(async () => {
      const result = await submitQuiz(answers);
      if (!result.ok || !result.score) {
        setError(result.error ?? 'That did not save.');
        return;
      }
      setSettled({
        score: result.score,
        bundleName: result.bundleName ?? '',
        invited: result.invited === true,
      });
      // The gate moved from quiz to bundle on the server; pull the new shell
      // so the sidebar and the dashboard stop treating this as unfinished.
      router.refresh();
    });
  }, [answers, last, router]);

  const back = useCallback(() => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  if (settled) {
    return <Reveal firstName={firstName} settled={settled} />;
  }

  if (!question) return null;

  /* Screen 0 reveals a follow-up only when the member names a peak. */
  const showPeak = step === 0 && answers.shape === 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.chapter}>{chrome.chapter}</p>
        <div
          className={styles.progress}
          role="progressbar"
          aria-valuenow={chrome.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Assessment progress"
        >
          <span className={styles.progressFill} style={{ width: `${chrome.progress}%` }} />
        </div>
        <p className={styles.counter}>{chrome.counter}</p>
      </header>

      <section className={styles.step}>
        <h1 className={styles.question}>{question.q}</h1>
        {question.sub ? <p className={styles.sub}>{question.sub}</p> : null}

        {question.kind === 'single' && question.opts ? (
          <div className={styles.options}>
            {question.opts.map((label, i) => (
              <button
                key={label}
                type="button"
                className={pickedSingle(step, answers) === i ? styles.optionOn : styles.option}
                aria-pressed={pickedSingle(step, answers) === i}
                onClick={() => patch(singlePatch(step, i))}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {showPeak ? (
          <div className={styles.reveal}>
            <p className={styles.revealLabel}>When does it hit?</p>
            <div className={styles.chips}>
              {PEAK_BLOCKS.map((block) => (
                <button
                  key={block.value}
                  type="button"
                  className={answers.peakBlock === block.value ? styles.chipOn : styles.chip}
                  aria-pressed={answers.peakBlock === block.value}
                  onClick={() => patch({ peakBlock: block.value })}
                >
                  {block.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {question.kind === 'double' && question.opts && question.opts2 ? (
          <>
            <div className={styles.options}>
              {question.opts.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={answers.timescale === i ? styles.optionOn : styles.option}
                  aria-pressed={answers.timescale === i}
                  onClick={() => patch({ timescale: i })}
                >
                  {label}
                </button>
              ))}
            </div>
            <h2 className={styles.subQuestion}>{question.q2}</h2>
            <div className={styles.options}>
              {question.opts2.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={answers.input === i ? styles.optionOn : styles.option}
                  aria-pressed={answers.input === i}
                  onClick={() => patch({ input: i })}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {question.kind === 'multi' && question.opts ? (
          <div className={styles.options}>
            {question.opts.map((label, i) => {
              const on = (answers.govern ?? []).includes(i);
              return (
                <button
                  key={label}
                  type="button"
                  className={on ? styles.optionOn : styles.option}
                  aria-pressed={on}
                  onClick={() => {
                    const current = answers.govern ?? [];
                    patch({
                      govern: on ? current.filter((n) => n !== i) : [...current, i].sort(),
                    });
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        {question.kind === 'text' ? (
          <textarea
            className={styles.textarea}
            placeholder={question.placeholder ?? ''}
            maxLength={2000}
            value={answers.carrying ?? ''}
            onChange={(e) => patch({ carrying: e.target.value })}
          />
        ) : null}
      </section>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!ready || pending}
          onClick={advance}
        >
          {pending ? 'Reading your pattern' : chrome.button}
        </button>
        {step > 0 ? (
          <button type="button" className={styles.quiet} onClick={back} disabled={pending}>
            Back
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Which stored field a single-choice screen writes to. */
function singlePatch(step: number, value: number): Partial<QuizAnswers> {
  switch (step) {
    case 0:
      // Changing the answer must clear a peak chosen under the old one,
      // otherwise a stale peak keeps gate three open.
      return value === 0 ? { shape: 0 } : { shape: value, peakBlock: undefined };
    case 1:
      return { resource: value };
    case 3:
      return { source: value };
    case 4:
      return { history: value };
    case 5:
      return { leaning: value };
    case 6:
      return { season: value };
    case 7:
      return { matters: value };
    case 9:
      return { looking: value };
    default:
      return {};
  }
}

function pickedSingle(step: number, a: QuizAnswers): number | undefined {
  switch (step) {
    case 0:
      return a.shape;
    case 1:
      return a.resource;
    case 3:
      return a.source;
    case 4:
      return a.history;
    case 5:
      return a.leaning;
    case 6:
      return a.season;
    case 7:
      return a.matters;
    case 9:
      return a.looking;
    default:
      return undefined;
  }
}

function Reveal({ firstName, settled }: { firstName: string; settled: Settled }) {
  const { score, bundleName, invited } = settled;
  const copy = PATTERN_REVEAL[score.pattern];

  return (
    <div className={styles.revealPage}>
      <p className={styles.chapter}>Your pattern, {firstName}</p>
      <h1 className={styles.revealName}>
        {copy.halves[0]}
        <span className={styles.revealNameLow}>{copy.halves[1]}</span>
      </h1>
      <p className={styles.revealSig}>{copy.sig}</p>

      <div className={styles.readout}>
        <div className={styles.readoutItem}>
          <span className={styles.readoutLabel}>Season</span>
          <span className={styles.readoutValue}>
            {LOAD_SEASON_LABEL[score.loadSeason] ?? score.loadSeason}
          </span>
        </div>
        <div className={styles.readoutItem}>
          <span className={styles.readoutLabel}>Load</span>
          <span className={styles.readoutValue}>{score.loadScore} of 8</span>
        </div>
        <div className={styles.readoutItem}>
          <span className={styles.readoutLabel}>Carried as</span>
          <span className={styles.readoutValue}>
            {IDENTITY_LABEL[score.identityProfile] ?? score.identityProfile}
          </span>
        </div>
        {score.peakBlock ? (
          <div className={styles.readoutItem}>
            <span className={styles.readoutLabel}>Peak</span>
            <span className={styles.readoutValue}>
              {PEAK_LABEL[score.peakBlock] ?? score.peakBlock}
            </span>
          </div>
        ) : null}
      </div>

      {bundleName ? (
        <p className={styles.sub}>
          Built for this pattern: <strong>{bundleName}</strong>. It is yours to claim, shipping
          only, once a month.
        </p>
      ) : null}

      {invited ? (
        <p className={styles.sub}>Your community invite is already on its way to your inbox.</p>
      ) : null}

      <div className={styles.actions}>
        <Link href="/claim" className={styles.link}>
          Claim my bundle
        </Link>
        <Link href="/" className={styles.linkQuiet}>
          Take me home
        </Link>
      </div>
    </div>
  );
}
