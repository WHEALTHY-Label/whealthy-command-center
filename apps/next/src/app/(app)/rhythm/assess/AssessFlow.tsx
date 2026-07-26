'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ACCOUNTABILITY_OPTIONS,
  canAdvance,
  chronotypeLine,
  emptyAnswers,
  FAMILY_ANCHOR_TYPES,
  RMEQ_QUESTIONS,
  STEPS,
  summaryLines,
  WEEKDAYS,
  type AssessmentAnswers,
  type Chronotype,
  type FamilyAnchorType,
} from '@/lib/assessment';
import { submitAssessment } from './actions';
import styles from './assess.module.css';

export function AssessFlow() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AssessmentAnswers>(emptyAnswers);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ chronotype: Chronotype | null } | null>(null);
  const [pending, startTransition] = useTransition();

  const step = STEPS[index]!;
  const patch = (next: Partial<AssessmentAnswers>) => setAnswers((a) => ({ ...a, ...next }));

  const chooseRmeq = (question: number, points: number) => {
    setAnswers((a) => {
      const rmeq = [...a.rmeq];
      rmeq[question] = points;
      return { ...a, rmeq };
    });
    // Answering is the whole step; carry them forward without a second tap.
    setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitAssessment(answers);
      if (!result.ok) {
        setError(result.error ?? 'That did not save.');
        return;
      }
      setSaved({ chronotype: result.chronotype ?? null });
    });
  };

  if (saved) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Your season</p>
          <h1 className={styles.title}>This is what we heard.</h1>
        </header>
        {saved.chronotype ? (
          <p className={styles.settled}>{chronotypeLine(saved.chronotype)}</p>
        ) : null}
        <p className={styles.sub}>
          Nothing is scheduled yet. The next step drafts a rhythm around this, and you approve it
          before a single thing lands on your day.
        </p>
        <div className={styles.actions}>
          <Link href="/rhythm/build" className={styles.primary}>
            Build my rhythm
          </Link>
          <Link href="/rhythm" className={styles.quiet}>
            Not now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Rhythm assessment</p>
        <div className={styles.progress} aria-hidden="true">
          <span
            className={styles.progressFill}
            style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <p className={styles.progressLabel}>
          Step {index + 1} of {STEPS.length}
        </p>
      </header>

      {step.startsWith('rmeq-') ? (
        <RmeqStep
          questionIndex={Number(step.slice(5))}
          selected={answers.rmeq[Number(step.slice(5))] ?? null}
          onChoose={chooseRmeq}
        />
      ) : null}

      {step === 'clock' ? (
        <section className={styles.step}>
          <h1 className={styles.title}>When does your day begin and end?</h1>
          <p className={styles.sub}>
            The honest times, not the aspirational ones. These set the bounds we build inside.
          </p>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.label}>I wake</span>
              <input
                type="time"
                className={styles.input}
                value={answers.wakeTime}
                onChange={(e) => patch({ wakeTime: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>I sleep</span>
              <input
                type="time"
                className={styles.input}
                value={answers.sleepTime}
                onChange={(e) => patch({ sleepTime: e.target.value })}
              />
            </label>
          </div>
        </section>
      ) : null}

      {step === 'work' ? (
        <section className={styles.step}>
          <h1 className={styles.title}>What shape does your work take?</h1>
          <p className={styles.sub}>Skip anything that does not apply.</p>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.label}>Starts</span>
              <input
                type="time"
                className={styles.input}
                value={answers.workStart}
                onChange={(e) => patch({ workStart: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Ends</span>
              <input
                type="time"
                className={styles.input}
                value={answers.workEnd}
                onChange={(e) => patch({ workEnd: e.target.value })}
              />
            </label>
          </div>
          <span className={styles.label}>Days</span>
          <div className={styles.chips}>
            {WEEKDAYS.map((day) => {
              const on = answers.workDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  className={on ? styles.chipOn : styles.chip}
                  aria-pressed={on}
                  onClick={() =>
                    patch({
                      workDays: on
                        ? answers.workDays.filter((d) => d !== day.value)
                        : [...answers.workDays, day.value],
                    })
                  }
                >
                  {day.short}
                </button>
              );
            })}
          </div>
          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={answers.remote}
              onChange={(e) => patch({ remote: e.target.checked })}
            />
            <span>I work from home</span>
          </label>
        </section>
      ) : null}

      {step === 'anchors' ? <AnchorsStep answers={answers} patch={patch} /> : null}

      {step === 'accountability' ? (
        <section className={styles.step}>
          <h1 className={styles.title}>Who carries this with you?</h1>
          <p className={styles.sub}>There is no wrong answer. Some seasons are quiet ones.</p>
          <div className={styles.options}>
            {ACCOUNTABILITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  answers.accountability === option.value ? styles.optionOn : styles.option
                }
                aria-pressed={answers.accountability === option.value}
                onClick={() => patch({ accountability: option.value })}
              >
                <span className={styles.optionLabel}>{option.label}</span>
                <span className={styles.optionNote}>{option.note}</span>
              </button>
            ))}
          </div>
          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={answers.fastingOptIn}
              onChange={(e) => patch({ fastingOptIn: e.target.checked })}
            />
            <span>Fasting is part of my rhythm</span>
          </label>
          {answers.fastingOptIn ? (
            <label className={styles.field}>
              <span className={styles.label}>When</span>
              <input
                type="text"
                className={styles.input}
                placeholder="Wednesdays, sunrise to sundown"
                value={answers.fastingWindow}
                onChange={(e) => patch({ fastingWindow: e.target.value })}
              />
            </label>
          ) : null}
        </section>
      ) : null}

      {step === 'summary' ? (
        <section className={styles.step}>
          <h1 className={styles.title}>Here is your season.</h1>
          <ul className={styles.summary}>
            {summaryLines(answers).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <p className={styles.sub}>
            If any of that is wrong, step back and change it. Nothing is scheduled from this screen.
          </p>
        </section>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.nav}>
        <button
          type="button"
          className={styles.quiet}
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0 || pending}
        >
          Back
        </button>
        {step === 'summary' ? (
          <button type="button" className={styles.primary} onClick={save} disabled={pending}>
            {pending ? 'Saving' : 'Save and continue'}
          </button>
        ) : step.startsWith('rmeq-') ? null : (
          <button
            type="button"
            className={styles.primary}
            onClick={() => setIndex((i) => Math.min(i + 1, STEPS.length - 1))}
            disabled={!canAdvance(step, answers)}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

function RmeqStep({
  questionIndex,
  selected,
  onChoose,
}: {
  questionIndex: number;
  selected: number | null;
  onChoose: (question: number, points: number) => void;
}) {
  const question = RMEQ_QUESTIONS[questionIndex];
  if (!question) return null;
  return (
    <section className={styles.step}>
      <h1 className={styles.title}>{question.prompt}</h1>
      <div className={styles.options}>
        {question.options.map((option) => (
          <button
            key={option.label}
            type="button"
            className={selected === option.points ? styles.optionOn : styles.option}
            aria-pressed={selected === option.points}
            onClick={() => onChoose(questionIndex, option.points)}
          >
            <span className={styles.optionLabel}>{option.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AnchorsStep({
  answers,
  patch,
}: {
  answers: AssessmentAnswers;
  patch: (next: Partial<AssessmentAnswers>) => void;
}) {
  const [label, setLabel] = useState('');
  const [when, setWhen] = useState('');

  const add = () => {
    if (!label.trim()) return;
    patch({
      nonNegotiables: [...answers.nonNegotiables, { label: label.trim(), when: when.trim() }],
    });
    setLabel('');
    setWhen('');
  };

  const setAnchor = (type: FamilyAnchorType, value: string) => {
    const rest = answers.familyAnchors.filter((a) => a.type !== type);
    patch({ familyAnchors: value ? [...rest, { type, when: value }] : rest });
  };

  return (
    <section className={styles.step}>
      <h1 className={styles.title}>What already holds your week?</h1>
      <p className={styles.sub}>
        Name what must not move. We build the rhythm around these, not over them.
      </p>

      <div className={styles.anchorAdd}>
        <input
          type="text"
          className={styles.input}
          placeholder="The Word"
          aria-label="What"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          type="text"
          className={styles.input}
          placeholder="before coffee"
          aria-label="When"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
        <button type="button" className={styles.add} onClick={add} disabled={!label.trim()}>
          Add
        </button>
      </div>

      {answers.nonNegotiables.length > 0 ? (
        <ul className={styles.anchorList}>
          {answers.nonNegotiables.map((item, i) => (
            <li key={`${item.label}-${i}`} className={styles.anchorItem}>
              <span>
                {item.label}
                {item.when ? <span className={styles.anchorWhen}> — {item.when}</span> : null}
              </span>
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove ${item.label}`}
                onClick={() =>
                  patch({ nonNegotiables: answers.nonNegotiables.filter((_, j) => j !== i) })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <span className={styles.label}>Family anchors</span>
      <div className={styles.familyGrid}>
        {FAMILY_ANCHOR_TYPES.map((type) => (
          <label key={type.value} className={styles.field}>
            <span className={styles.labelQuiet}>{type.label}</span>
            <input
              type="text"
              className={styles.input}
              placeholder="Friday 7pm"
              value={answers.familyAnchors.find((a) => a.type === type.value)?.when ?? ''}
              onChange={(e) => setAnchor(type.value, e.target.value)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
