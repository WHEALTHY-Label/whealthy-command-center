'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ATTACH_CATEGORIES,
  FASTS,
  GUARD_COPY,
  LAY_GROUPS,
  WHYS,
  altLine,
  computeExclusions,
  defaultTakes,
  findPattern,
  fmtTime,
  guardFreeText,
  initialWizardState,
  matchFast,
  recommendAnchors,
  unfinishedLine,
  type AnchorReasons,
  type Experience,
  type FastAnchors,
  type FastHistoryRow,
  type FreeGuard,
  type WizardState,
} from '@/lib/fastbuild';
import { forgeFast } from './actions';
import { HoldButton } from './HoldButton';
import { ScriptureRefs } from './ScriptureRefs';
import ui from '@/components/ui.module.css';
import styles from './wizard.module.css';

export interface PrayerOption {
  id: string;
  body: string;
  category: string;
}

const TOTAL_STEPS = 10;

const FORGE_LINES = [
  'Reading what you chose to lay down.',
  'Setting it to scripture.',
  'Structuring your fast.',
];

type Screen = 'threshold' | 'gate' | 'steps' | 'forging';

export function WizardClient({
  prayers,
  lastFast,
  historyCount,
  equipped,
  openingAnchors,
  openingReasons,
  readiness,
  todayIso,
}: {
  prayers: PrayerOption[];
  lastFast: FastHistoryRow | null;
  historyCount: number;
  equipped: boolean;
  openingAnchors: FastAnchors;
  openingReasons: AnchorReasons;
  readiness: string | null;
  todayIso: string;
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('threshold');
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(() => ({
    ...initialWizardState(),
    anchors: { ...openingAnchors },
    start: todayIso,
  }));
  const [reasons, setReasons] = useState<AnchorReasons>(openingReasons);
  const [freeLay, setFreeLay] = useState('');
  const [guard, setGuard] = useState<FreeGuard>(null);
  const [addRemoval, setAddRemoval] = useState('');
  const [addAddition, setAddAddition] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [forgeText, setForgeText] = useState('');

  const patch = (next: Partial<WizardState>) => setState((s) => ({ ...s, ...next }));

  /* -------------------- the forge -------------------- */

  // The typing animation. Every setState lands inside a timeout, never in the
  // effect body, so the React Compiler's set-state-in-effect rule holds.
  useEffect(() => {
    if (screen !== 'forging') return;
    let cancelled = false;
    let line = 0;
    let char = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (cancelled) return;
      const text = FORGE_LINES[line % FORGE_LINES.length] ?? '';
      if (char <= text.length) {
        setForgeText(text.slice(0, char));
        char += 1;
        timer = setTimeout(tick, 32);
      } else {
        line += 1;
        char = 0;
        timer = setTimeout(tick, 1100);
      }
    };
    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [screen]);

  const forge = () => {
    setError(null);
    setScreen('forging');
    void forgeFast(state).then((result) => {
      if (!result.ok) {
        setScreen('steps');
        setStep(TOTAL_STEPS);
        setError(result.error ?? 'The fast did not save. Please try again.');
        return;
      }
      router.replace('/fast');
      router.refresh();
    });
  };

  /* -------------------- step gates -------------------- */

  const pattern = findPattern(state.matchedId);
  const alt = findPattern(state.altId);
  const duration = state.dur ?? pattern?.days ?? 0;
  const primaryWhy = state.whys[0] ?? 'nearness';
  const anySafety = state.safetyDiabetic || state.safetyBP || state.safetyEating;

  const canAdvance = (): boolean => {
    if (step === 1) return state.laid.length > 0 && (!state.laid.includes('Coffee') || !!state.caffScope);
    if (step === 2) return state.whys.length > 0;
    if (step === 3) return !!state.exp;
    if (step === 5) {
      const hasBody = state.attachedNewBody.trim().length > 0;
      const hasCat = state.attachedNewCategory.length > 0;
      return hasBody === hasCat;
    }
    if (step === 6) return !!pattern && !!state.start;
    return true;
  };

  const advance = () => {
    setError(null);
    setGuard(null);
    if (step === 5) {
      // Entering the pattern step: score the fasts once, then leave the
      // choice to the member.
      const m = matchFast(state.whys, state.exp, lastFast);
      patch({ matchedId: m.primary.id, altId: m.alt ? m.alt.id : null, dur: null });
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goBack = () => {
    setError(null);
    setGuard(null);
    setStep((s) => Math.max(1, s - 1));
  };

  /* -------------------- step 1 helpers -------------------- */

  const toggleLay = (item: string) => {
    setGuard(null);
    setState((s) => {
      const on = s.laid.includes(item);
      const laid = on ? s.laid.filter((x) => x !== item) : [...s.laid, item];
      // Dropping coffee drops the scope question with it.
      const caffScope = item === 'Coffee' && on ? null : s.caffScope;
      return { ...s, laid, caffScope };
    });
  };

  /**
   * Adding something to the removal list by hand, from step 1 or step 10. A
   * weight goal is refused outright and a full food fast flips the fast to
   * structure only. Either way the guard card explains the decision.
   */
  const addLaidItem = (raw: string, clear: () => void) => {
    const text = raw.trim();
    if (!text) return;
    const verdict = guardFreeText(text);
    setGuard(verdict);
    clear();
    // A diet goal is never added. The card says why.
    if (verdict === 'weight') return;
    setState((s) => ({
      ...s,
      laid: s.laid.includes(text) ? s.laid : [...s.laid, text],
      structureOnly: verdict === 'food' ? true : s.structureOnly,
    }));
  };

  const commitFreeLay = () => addLaidItem(freeLay, () => setFreeLay(''));
  const commitAddRemoval = () => addLaidItem(addRemoval, () => setAddRemoval(''));

  const commitAddAddition = () => {
    const text = addAddition.trim();
    if (!text) return;
    setState((s) => ({
      ...s,
      takingOn: s.takingOn.includes(text) ? s.takingOn : [...s.takingOn, text],
    }));
    setAddAddition('');
  };

  /* -------------------- step 7 and 8 helpers -------------------- */

  const setConsent = (consent: boolean) => {
    const next = recommendAnchors(consent, lastFast, equipped);
    setState((s) => ({ ...s, recordConsent: consent, anchors: { ...next.anchors } }));
    setReasons(next.reasons);
  };

  const setAnchor = <K extends keyof FastAnchors>(key: K, value: FastAnchors[K]) =>
    setState((s) => ({ ...s, anchors: { ...s.anchors, [key]: value } }));

  const stepNumber = (key: 'oz' | 'laps' | 'journal', delta: number, lo: number, hi: number) =>
    setState((s) => ({
      ...s,
      anchors: { ...s.anchors, [key]: Math.min(hi, Math.max(lo, s.anchors[key] + delta)) },
    }));

  /* -------------------- threshold and gate -------------------- */

  if (screen === 'threshold') {
    return (
      <section className={ui.card}>
        <h2 className={styles.headline}>
          What are you carrying that you need to <em>lay down?</em>
        </h2>
        <p className={ui.body}>
          Scripture chooses the pattern. You bring the commitment. Built in four minutes.
        </p>
        {readiness ? (
          <p className={styles.guard}>
            <b>An honest read before you begin.</b> {readiness}
          </p>
        ) : null}
        <button type="button" className={ui.primary} onClick={() => setScreen('gate')}>
          Begin
        </button>
      </section>
    );
  }

  if (screen === 'gate') {
    return (
      <section className={ui.card}>
        <h3 className={styles.headline}>Before we build.</h3>
        <p className={ui.body}>
          This tool gives no health or medical advice. It takes commitments you choose and
          organizes them into a structure with scripture and rhythm.
        </p>
        <p className={ui.body}>
          We recommend talking with a healthcare professional before beginning any fast that
          changes how you eat or drink.
        </p>
        <p className={ui.body}>
          You can end your fast at any time. Nothing here will shame you for it.
        </p>
        <p className={ui.body}>
          These are suggestions for structure. The decisions, and the fast, are yours.
        </p>
        <HoldButton
          label="Hold to Commit · This is my fast, structured."
          onComplete={() => {
            patch({ ackAt: new Date().toISOString() });
            setScreen('steps');
            setStep(1);
          }}
        />
        <p className={ui.sub}>Press and hold. A fast is not tapped into, it is entered.</p>
      </section>
    );
  }

  if (screen === 'forging') {
    return (
      <section className={ui.card}>
        <div className={styles.forge}>
          <p className={styles.forgeLine} aria-live="polite">
            {forgeText}
            <span className={styles.caret}>|</span>
          </p>
        </div>
      </section>
    );
  }

  /* -------------------- the ten steps -------------------- */

  const title =
    step === 1
      ? 'What are you laying down?'
      : step === 2
        ? 'Why this fast?'
        : step === 3
          ? 'Where are you with fasting?'
          : step === 4
            ? 'Safety Gate'
            : step === 5
              ? 'Attach a prayer request'
              : step === 6
                ? 'Your fast, from scripture.'
                : step === 7
                  ? 'Should your record shape this?'
                  : step === 8
                    ? 'Your recommended rhythm.'
                    : step === 9
                      ? 'Who carries it with you?'
                      : 'Confirm your commitments';

  const sub =
    step === 1
      ? 'Choose everything that applies. This is your fast, not a menu we hand you.'
      : step === 2
        ? 'Choose everything that is true. A man rarely fasts for one reason, and scripture will meet you where you actually are.'
        : step === 3
          ? 'Honest answer. It shapes how much the plan teaches and what it recommends.'
          : step === 4
            ? 'Please review these medical checks before choosing your fast pattern. Your safety before God is first.'
            : step === 5
              ? 'Attach an active prayer request to this fast. When the fast ends, you can record what happened directly to the prayer.'
              : step === 6
                ? 'Based on what you carry and why, this is the pattern that fits. You can accept it or choose another.'
                : step === 7
                  ? 'Your journal already knows your real rhythms. With permission, the builder reads it to set honest anchors instead of fantasy ones, and to name what your prayer weeks should carry.'
                  : step === 8
                    ? `Set from your pattern${state.recordConsent ? ', your record,' : ''}${historyCount > 0 ? ' your last fast,' : ''} and what you own. Reviewed, not built from scratch. Adjust anything that does not fit.`
                    : step === 9
                      ? 'Fasting in secret is honored here. So is not carrying it alone.'
                      : 'Review the two lists. Either list may be empty. We will never ask you to justify one against the other.';

  const nextLabel = step === 6 ? 'Accept This Fast' : step === TOTAL_STEPS ? 'Structure My Fast' : 'Next';

  const takes = defaultTakes(state.anchors);

  return (
    <section className={ui.card}>
      <div className={styles.progress} aria-hidden="true">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span key={i} className={i < step ? `${styles.dot} ${styles.dotOn}` : styles.dot} />
        ))}
      </div>

      <p className={ui.kicker}>
        Step {step} of {TOTAL_STEPS}
      </p>
      <h2 className={styles.headline}>{title}</h2>
      <p className={ui.body}>{sub}</p>

      {step === 1 ? (
        <>
          {LAY_GROUPS.map((g) => (
            <div key={g.label}>
              <p className={styles.groupLabel}>{g.label}</p>
              <div className={ui.chipRow}>
                {g.items.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={state.laid.includes(item)}
                    className={state.laid.includes(item) ? `${ui.chip} ${ui.chipActive}` : ui.chip}
                    onClick={() => toggleLay(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {state.laid.some((x) => !LAY_GROUPS.some((g) => g.items.includes(x))) ? (
            <div>
              <p className={styles.groupLabel}>Your own</p>
              <div className={ui.chipRow}>
                {state.laid
                  .filter((x) => !LAY_GROUPS.some((g) => g.items.includes(x)))
                  .map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed
                      className={`${ui.chip} ${ui.chipActive}`}
                      onClick={() => toggleLay(item)}
                    >
                      {item}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}

          {state.laid.includes('Coffee') ? (
            <>
              <p className={styles.groupLabelLime}>Coffee only, or caffeine altogether?</p>
              <div className={ui.chipRow}>
                <button
                  type="button"
                  aria-pressed={state.caffScope === 'coffee'}
                  className={state.caffScope === 'coffee' ? `${ui.chip} ${ui.chipActive}` : ui.chip}
                  onClick={() => patch({ caffScope: 'coffee' })}
                >
                  Coffee only
                </button>
                <button
                  type="button"
                  aria-pressed={state.caffScope === 'all'}
                  className={state.caffScope === 'all' ? `${ui.chip} ${ui.chipActive}` : ui.chip}
                  onClick={() => patch({ caffScope: 'all' })}
                >
                  Caffeine altogether
                </button>
              </div>
            </>
          ) : null}

          <div className={styles.addRow}>
            <input
              className={ui.input}
              value={freeLay}
              maxLength={60}
              placeholder="Something else (type it plainly)"
              onChange={(e) => setFreeLay(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitFreeLay();
                }
              }}
            />
            <button type="button" className={styles.addBtn} onClick={commitFreeLay}>
              Add
            </button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <div className={styles.tiles}>
          {WHYS.map((w) => (
            <button
              key={w.key}
              type="button"
              aria-pressed={state.whys.includes(w.key)}
              className={state.whys.includes(w.key) ? styles.tileActive : styles.tile}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  whys: s.whys.includes(w.key)
                    ? s.whys.filter((x) => x !== w.key)
                    : [...s.whys, w.key],
                  matchedId: null,
                  altId: null,
                }))
              }
            >
              <span className={styles.tileTitle}>{w.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <div className={styles.tiles}>
          {(
            [
              { key: 'never', label: 'Never fasted' },
              { key: 'few', label: 'A few times' },
              { key: 'life', label: 'It is part of my life' },
            ] as { key: Experience; label: string }[]
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={state.exp === o.key}
              className={state.exp === o.key ? styles.tileActive : styles.tile}
              onClick={() => patch({ exp: o.key, matchedId: null, altId: null })}
            >
              <span className={styles.tileTitle}>{o.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === 4 ? (
        <>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={state.safetyDiabetic}
              onChange={(e) => patch({ safetyDiabetic: e.target.checked })}
            />
            <span>I am managing diabetes or metabolic conditions</span>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={state.safetyBP}
              onChange={(e) => patch({ safetyBP: e.target.checked })}
            />
            <span>I take blood pressure medications</span>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={state.safetyEating}
              onChange={(e) => patch({ safetyEating: e.target.checked })}
            />
            <span>I have a history of eating disorders or disordered eating</span>
          </label>
          {anySafety ? (
            <p className={styles.guard}>
              <b>Notice:</b> Based on your checks, we recommend consulting a doctor before
              initiating any food or metabolic fast. You may still proceed with the builder, but
              please prioritize your health and wisdom.
            </p>
          ) : null}
        </>
      ) : null}

      {step === 5 ? (
        <>
          <p className={styles.groupLabel}>Choose an active prayer request</p>
          {prayers.length === 0 ? (
            <p className={ui.empty}>
              <i>No active prayer requests found in your Closet Mirror.</i>
            </p>
          ) : (
            <div className={styles.tiles}>
              {prayers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={state.attachedPrayerId === p.id}
                  className={state.attachedPrayerId === p.id ? styles.tileActive : styles.tile}
                  onClick={() =>
                    patch({
                      attachedPrayerId: state.attachedPrayerId === p.id ? null : p.id,
                      attachedNewBody: '',
                      attachedNewCategory: '',
                    })
                  }
                >
                  <span className={styles.tileCat}>{p.category}</span>
                  <span>{p.body}</span>
                </button>
              ))}
            </div>
          )}

          <p className={styles.groupLabel}>Or write a new prayer request</p>
          <textarea
            className={ui.textarea}
            value={state.attachedNewBody}
            maxLength={1000}
            placeholder="What are you praying forward for during this fast?"
            onChange={(e) => patch({ attachedNewBody: e.target.value, attachedPrayerId: null })}
          />
          {state.attachedNewBody.trim().length > 0 ? (
            <>
              <p className={styles.groupLabelLime}>Select category (Required for new prayer)</p>
              <div className={ui.chipRow}>
                {ATTACH_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={state.attachedNewCategory === c}
                    className={
                      state.attachedNewCategory === c ? `${ui.chip} ${ui.chipActive}` : ui.chip
                    }
                    onClick={() => patch({ attachedNewCategory: c })}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {step === 6 && pattern ? (
        <>
          <div className={styles.tileActive}>
            <span className={styles.tileCat}>{pattern.title}</span>
            <p className={ui.body}>{pattern.line}</p>
            <p className={styles.planLine}>{pattern.pattern}</p>
            <ScriptureRefs refs={pattern.refs} />
            <p className={styles.tileSmall}>Recommended length: {pattern.days} days</p>
          </div>

          {alt ? <p className={ui.body}>{altLine(alt, pattern, primaryWhy)}</p> : null}
          {unfinishedLine(lastFast) ? (
            <p className={styles.notice}>{unfinishedLine(lastFast)}</p>
          ) : null}
          {state.exp === 'never' && pattern.days >= 40 ? (
            <p className={styles.guard}>
              <b>Forty is earned.</b> Finish a shorter fast first, then come back for the
              wilderness. You may proceed, but that is our honest read.
            </p>
          ) : null}

          {alt ? (
            <>
              <p className={styles.groupLabel}>Or follow a different pattern</p>
              <button
                type="button"
                className={styles.tile}
                onClick={() => patch({ matchedId: alt.id, altId: pattern.id, dur: null })}
              >
                <span className={styles.tileTitle}>{alt.title}</span>
                <span className={styles.tileSmall}>
                  {alt.figure} · {alt.days} days
                </span>
              </button>
            </>
          ) : null}

          <div className={styles.anchorRow}>
            <p className={styles.anchorLabel}>Start date</p>
            <input
              type="date"
              className={`${ui.input} ${styles.timeInput}`}
              value={state.start ?? todayIso}
              min={todayIso}
              onChange={(e) => patch({ start: e.target.value || todayIso })}
            />
          </div>
        </>
      ) : null}

      {step === 7 ? (
        <div className={styles.tiles}>
          <button
            type="button"
            aria-pressed={state.recordConsent}
            className={state.recordConsent ? styles.tileActive : styles.tile}
            onClick={() => setConsent(true)}
          >
            <span className={styles.tileTitle}>Yes, read my record</span>
            <span className={styles.tileSmall}>
              Anchors and prayer focus set from what is actually true
            </span>
          </button>
          <button
            type="button"
            aria-pressed={!state.recordConsent}
            className={!state.recordConsent ? styles.tileActive : styles.tile}
            onClick={() => setConsent(false)}
          >
            <span className={styles.tileTitle}>No, keep it separate</span>
            <span className={styles.tileSmall}>The plan uses only what I set by hand</span>
          </button>
        </div>
      ) : null}

      {step === 8 ? (
        <>
          <div className={styles.anchorRow}>
            <div className={styles.anchorHead}>
              <p className={styles.anchorLabel}>Wake up</p>
              <span className={styles.tileSmall}>{fmtTime(state.anchors.wake)}</span>
            </div>
            <input
              type="time"
              className={`${ui.input} ${styles.timeInput}`}
              value={state.anchors.wake}
              onChange={(e) => setAnchor('wake', e.target.value)}
            />
            <p className={styles.anchorReason}>{reasons.wake}</p>
          </div>

          <div className={styles.anchorRow}>
            <div className={styles.anchorHead}>
              <p className={styles.anchorLabel}>Lights out</p>
              <span className={styles.tileSmall}>{fmtTime(state.anchors.lights)}</span>
            </div>
            <input
              type="time"
              className={`${ui.input} ${styles.timeInput}`}
              value={state.anchors.lights}
              onChange={(e) => setAnchor('lights', e.target.value)}
            />
            <p className={styles.anchorReason}>{reasons.lights}</p>
          </div>

          <div className={styles.anchorRow}>
            <p className={styles.anchorLabel}>Daily hydration</p>
            <div className={styles.stepper}>
              <button
                type="button"
                className={styles.stepBtn}
                aria-label="Less hydration"
                disabled={state.anchors.oz <= 64}
                onClick={() => stepNumber('oz', -16, 64, 160)}
              >
                −
              </button>
              <span className={styles.stepValue}>{state.anchors.oz} oz</span>
              <button
                type="button"
                className={styles.stepBtn}
                aria-label="More hydration"
                disabled={state.anchors.oz >= 160}
                onClick={() => stepNumber('oz', 16, 64, 160)}
              >
                +
              </button>
            </div>
            <p className={styles.anchorReason}>{reasons.oz}</p>
          </div>

          <div className={styles.anchorRow}>
            <div className={styles.anchorHead}>
              <p className={styles.anchorLabel}>Morning movement</p>
              <button
                type="button"
                className={state.anchors.movement ? `${ui.chip} ${ui.chipActive}` : ui.chip}
                aria-pressed={state.anchors.movement}
                onClick={() => setAnchor('movement', !state.anchors.movement)}
              >
                {state.anchors.movement ? 'On' : 'Off'}
              </button>
            </div>
            <p className={styles.anchorSmall}>Bodyweight and household items only</p>
          </div>

          <div className={styles.anchorRow}>
            <p className={styles.anchorLabel}>Daily walk</p>
            <div className={styles.stepper}>
              <button
                type="button"
                className={styles.stepBtn}
                aria-label="Fewer laps"
                disabled={state.anchors.laps <= 0}
                onClick={() => stepNumber('laps', -1, 0, 6)}
              >
                −
              </button>
              <span className={styles.stepValue}>
                {state.anchors.laps} lap{state.anchors.laps === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                className={styles.stepBtn}
                aria-label="More laps"
                disabled={state.anchors.laps >= 6}
                onClick={() => stepNumber('laps', 1, 0, 6)}
              >
                +
              </button>
            </div>
          </div>

          <div className={styles.anchorRow}>
            <p className={styles.anchorLabel}>Journal minimum</p>
            <div className={styles.stepper}>
              <button
                type="button"
                className={styles.stepBtn}
                aria-label="Less journalling"
                disabled={state.anchors.journal <= 5}
                onClick={() => stepNumber('journal', -5, 5, 30)}
              >
                −
              </button>
              <span className={styles.stepValue}>{state.anchors.journal} min</span>
              <button
                type="button"
                className={styles.stepBtn}
                aria-label="More journalling"
                disabled={state.anchors.journal >= 30}
                onClick={() => stepNumber('journal', 5, 5, 30)}
              >
                +
              </button>
            </div>
          </div>

          <div className={styles.anchorRow}>
            <div className={styles.anchorHead}>
              <p className={styles.anchorLabel}>Prayer, morning and night</p>
              <span className={styles.fixedChip}>On</span>
            </div>
            <p className={styles.anchorSmall}>The spine of the fast. This one stays on.</p>
          </div>

          <p className={ui.sub}>
            Miss a rule, note it in your journal, own it, and get back on track the next morning.
            Do not quit the fast over one bad day.
          </p>
        </>
      ) : null}

      {step === 9 ? (
        <div className={styles.tiles}>
          {(
            [
              { key: 'alone', title: 'Alone before God', small: 'Kept between you and Him' },
              {
                key: 'brother',
                title: 'With my covenant brother',
                small: 'He sees the day count, never the contents',
              },
              {
                key: 'cohort',
                title: 'With a cohort',
                small: 'The structure shared, the contents private',
              },
            ] as { key: WizardState['carried']; title: string; small: string }[]
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={state.carried === o.key}
              className={state.carried === o.key ? styles.tileActive : styles.tile}
              onClick={() => patch({ carried: o.key })}
            >
              <span className={styles.tileTitle}>{o.title}</span>
              <span className={styles.tileSmall}>{o.small}</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === TOTAL_STEPS ? (
        <div className={styles.columns}>
          <div>
            <p className={styles.groupLabel}>
              Setting Down (Removal) · {state.laid.length} item
              {state.laid.length === 1 ? '' : 's'}
            </p>
            {state.laid.length === 0 ? (
              <p className={ui.empty}>No items on the removal list.</p>
            ) : (
              state.laid.map((item) => (
                <div key={item} className={styles.commitRow}>
                  <span>{item}</span>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        laid: s.laid.filter((x) => x !== item),
                        caffScope: item === 'Coffee' ? null : s.caffScope,
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
            <div className={styles.addRow}>
              <input
                className={ui.input}
                value={addRemoval}
                maxLength={60}
                placeholder="Add custom removal..."
                onChange={(e) => setAddRemoval(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  commitAddRemoval();
                }}
              />
              <button type="button" className={styles.addBtn} onClick={commitAddRemoval}>
                Add
              </button>
            </div>
          </div>

          <div>
            <p className={styles.groupLabel}>
              Taking On (Additions) · {takes.length + state.takingOn.length} item
              {takes.length + state.takingOn.length === 1 ? '' : 's'}
            </p>
            {takes.length === 0 && state.takingOn.length === 0 ? (
              <p className={ui.empty}>No items on the additions list.</p>
            ) : null}
            {takes.map((t) => (
              <div key={t} className={styles.commitRow}>
                <span>{t}</span>
                <span className={styles.commitTag}>Anchor</span>
              </div>
            ))}
            {state.takingOn.map((t) => (
              <div key={t} className={styles.commitRow}>
                <span>{t}</span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() =>
                    setState((s) => ({ ...s, takingOn: s.takingOn.filter((x) => x !== t) }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <div className={styles.addRow}>
              <input
                className={ui.input}
                value={addAddition}
                maxLength={60}
                placeholder="Add custom addition..."
                onChange={(e) => setAddAddition(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  commitAddAddition();
                }}
              />
              <button type="button" className={styles.addBtn} onClick={commitAddAddition}>
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === TOTAL_STEPS && computeExclusions(state.laid, state.caffScope).length > 0 ? (
        <p className={styles.anchorSmall}>
          Ruled out by this fast: {computeExclusions(state.laid, state.caffScope).join(', ')}.
        </p>
      ) : null}

      {step === TOTAL_STEPS && pattern ? (
        <p className={ui.sub}>
          {pattern.title} · {duration} days from {state.start ?? todayIso}.
        </p>
      ) : null}

      {/*
        The guard card sits outside the step blocks on purpose. Free text is
        entered on step 1 and again on step 10, and a rejected entry must never
        vanish without saying why.
      */}
      {guard ? (
        <p className={styles.guard}>
          <b>{GUARD_COPY[guard].lead}</b> {GUARD_COPY[guard].body}
        </p>
      ) : null}

      {error ? <p className={ui.error}>{error}</p> : null}

      <div className={styles.nav}>
        <button type="button" className={ui.quiet} onClick={goBack} disabled={step === 1}>
          Back
        </button>
        {step === 5 ? (
          <button
            type="button"
            className={ui.quiet}
            onClick={() => {
              patch({ attachedPrayerId: null, attachedNewBody: '', attachedNewCategory: '' });
              advance();
            }}
          >
            Skip Attachment
          </button>
        ) : null}
        <span className={styles.navSpacer} />
        <button
          type="button"
          className={ui.primary}
          disabled={!canAdvance()}
          onClick={() => (step === TOTAL_STEPS ? forge() : advance())}
        >
          {nextLabel}
        </button>
      </div>

      <p className={styles.footNote}>
        {FASTS.length} scriptural patterns. This tool provides structure, not health or medical
        advice.
      </p>
    </section>
  );
}
