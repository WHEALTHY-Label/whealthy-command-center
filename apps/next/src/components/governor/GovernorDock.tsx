'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { governSpeech, learnFromSpeech } from '@/lib/actions/governorSpeech';
import type { Dispatch } from '@/lib/governorIntent';
import { burnRecordEntry, fileJournalEntry } from '@/app/(app)/record/actions';
import styles from './governor.module.css';

/** Any surface can summon the Governor by dispatching this on `window`. */
export const GOVERNOR_OPEN_EVENT = 'whealthy:governor-open';

/* ── Web Speech API, typed narrowly. The DOM lib does not ship these. ── */

interface SpeechAlternative {
  readonly transcript: string;
}
interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechAlternative | undefined;
}
interface SpeechResultList {
  readonly length: number;
  readonly [index: number]: SpeechResult | undefined;
}
interface SpeechEvent {
  readonly resultIndex: number;
  readonly results: SpeechResultList;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** The short word the router reads as "active view". */
function viewWord(pathname: string): string {
  if (pathname === '/') return 'dash';
  const seg = pathname.split('/')[1];
  return seg && /^[a-z-]+$/.test(seg) ? seg : 'dash';
}

type Phase = 'idle' | 'listening' | 'thinking' | 'confirm' | 'settled';

const IDLE_LINE = 'Tap to speak. Or type it.';

export function GovernorDock() {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [line, setLine] = useState(IDLE_LINE);
  const [pending, setPending] = useState<Dispatch | null>(null);
  const [scribe, setScribe] = useState('');
  const [offer, setOffer] = useState('');
  const [muted, setMuted] = useState(false);
  const [dictation, setDictation] = useState(true);

  const recogRef = useRef<Recognition | null>(null);
  const finalRef = useRef('');

  /* Detect dictation support once mounted. Set outside the effect body so the
     compiler's set-state-in-effect rule stays satisfied. */
  useEffect(() => {
    const t = setTimeout(() => setDictation(recognitionCtor() !== null), 0);
    return () => clearTimeout(t);
  }, []);

  /* Summon from anywhere. */
  useEffect(() => {
    const onSummon = () => setOpen(true);
    window.addEventListener(GOVERNOR_OPEN_EVENT, onSummon);
    return () => window.removeEventListener(GOVERNOR_OPEN_EVENT, onSummon);
  }, []);

  const stopMic = useCallback(() => {
    const r = recogRef.current;
    recogRef.current = null;
    if (r) {
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      try {
        r.stop();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  const reset = useCallback(() => {
    stopMic();
    setPhase('idle');
    setLine(IDLE_LINE);
    setPending(null);
    setScribe('');
    setOffer('');
    setText('');
    finalRef.current = '';
  }, [stopMic]);

  const close = useCallback(() => {
    setOpen(false);
    reset();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [reset]);

  /* Escape closes, and stops the mic on the way out. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  /* Never leave a live microphone behind on unmount. */
  useEffect(() => stopMic, [stopMic]);

  const speak = useCallback(
    (message: string) => {
      if (muted || !message) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(message);
        u.rate = 1;
        window.speechSynthesis.speak(u);
      } catch {
        /* speech is a nicety, never a requirement */
      }
    },
    [muted],
  );

  const listen = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setDictation(false);
      return;
    }
    if (recogRef.current) {
      stopMic();
      setPhase('idle');
      setLine('Stopped. File it, or speak again.');
      return;
    }
    const r = new Ctor();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = true;
    finalRef.current = text ? `${text.trim()} ` : '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const alt = result?.[0];
        if (!result || !alt) continue;
        if (result.isFinal) finalRef.current += `${alt.transcript.trim()} `;
        else interim += alt.transcript;
      }
      setText((finalRef.current + interim).trimStart());
    };
    r.onerror = () => {
      stopMic();
      setPhase('idle');
      setLine('The mic did not catch that. Type it if it is easier.');
    };
    r.onend = () => {
      recogRef.current = null;
      setPhase('idle');
    };
    recogRef.current = r;
    try {
      r.start();
      setPhase('listening');
      setLine('Listening. Tap again when you are done.');
    } catch {
      recogRef.current = null;
      setDictation(false);
    }
  }, [stopMic, text]);

  /** Perform one decided action. Guarded intents arrive here only after the
   *  steward has pressed the affirmative button. */
  const perform = useCallback(
    async (d: Dispatch, spoken: string, tzOffsetMin: number) => {
      switch (d.kind) {
        case 'journal': {
          setLine('The scribe is keeping your words.');
          const res = await fileJournalEntry(spoken, tzOffsetMin, null, null);
          if (res.ok) {
            setPhase('settled');
            setScribe(res.scribe?.scribeLine ?? '');
            setLine(res.offline ? 'Entry kept. The record holds it.' : 'Entry kept.');
            speak(res.scribe?.scribeLine || 'Entry kept.');
            router.refresh();
          } else {
            setPhase('settled');
            setLine(res.error ?? 'That did not save. Please try again.');
          }
          return;
        }
        case 'burn': {
          const date = d.entryDate ?? '';
          setLine('Burning.');
          const res = await burnRecordEntry(date);
          setPhase('settled');
          setLine(res.ok ? 'The entry is gone.' : (res.error ?? 'That did not go through.'));
          if (res.ok) {
            speak('The entry is gone.');
            router.push('/record');
            router.refresh();
          }
          return;
        }
        case 'navigate': {
          setPhase('settled');
          setLine(d.message);
          speak(d.message);
          if (d.href) router.push(d.href);
          setTimeout(close, 900);
          return;
        }
        case 'speak': {
          setPhase('settled');
          setLine(d.message);
          speak(d.message);
          return;
        }
        case 'confirm': {
          setPhase('confirm');
          setPending(d);
          setLine(d.message);
          speak(d.message);
          return;
        }
      }
    },
    [close, router, speak],
  );

  const file = useCallback(async () => {
    const spoken = text.trim();
    if (!spoken) return;
    stopMic();
    setPhase('thinking');
    setLine('Working.');
    setScribe('');
    setOffer('');

    const tz = new Date().getTimezoneOffset();
    const turn = await governSpeech(spoken, 'governor', viewWord(pathname), tz);
    await perform(turn.dispatch, spoken, tz);

    /* A reference the Governor may offer once the action has landed. Below a
       comfort of 4 it is offered, never read over him. */
    if (turn.scriptureRef && turn.intent !== 'scripture_read') {
      setOffer(turn.scriptureRef);
      if (turn.scriptureComfort < 4) {
        speak('There is a passage under that if you want it.');
      }
    }

    /* The living portrait updates behind the steward, never in front of him.
       A failure here is deliberately invisible. */
    void learnFromSpeech(spoken, turn.intent, turn.dispatch.message).catch(() => undefined);
  }, [pathname, perform, speak, stopMic, text]);

  const confirm = useCallback(async () => {
    const next = pending?.onConfirm;
    if (!next) return;
    setPending(null);
    setPhase('thinking');
    await perform(next, text.trim(), new Date().getTimezoneOffset());
  }, [pending, perform, text]);

  const busy = phase === 'thinking';
  const listening = phase === 'listening';
  const destructive = pending?.onConfirm?.kind === 'burn';

  return (
    <>
      <button
        type="button"
        className={`${styles.launcher} ${listening ? styles.launcherLive : ''}`}
        aria-label={open ? 'Close the Governor' : 'Open the Governor'}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M5 11a7 7 0 0 0 14 0M12 18v3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <section className={styles.panel} role="dialog" aria-label="The Governor">
          <p className={styles.prompt}>Speak. The Governor listens.</p>

          {dictation ? (
            <button
              type="button"
              className={`${styles.recorder} ${listening ? styles.recorderLive : ''}`}
              onClick={listen}
              disabled={busy}
              aria-label={listening ? 'Stop listening' : 'Start listening'}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="9"
                  y="3"
                  width="6"
                  height="11"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M5 11a7 7 0 0 0 14 0M12 18v3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}

          <p className={styles.state} aria-live="polite">
            {line}
          </p>

          <label className={styles.srOnly} htmlFor="governorTranscript">
            What you want to say
          </label>
          <textarea
            id="governorTranscript"
            className={styles.transcript}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={dictation ? 'Or type it here.' : 'Type it here.'}
            disabled={busy}
          />

          {phase === 'confirm' && pending ? (
            <div className={`${styles.confirm} ${destructive ? '' : styles.confirmSafe}`}>
              <p className={styles.confirmText}>{pending.message}</p>
              <div className={styles.row}>
                <button
                  type="button"
                  className={destructive ? styles.danger : styles.primary}
                  onClick={() => void confirm()}
                >
                  {pending.confirmLabel ?? 'Do it'}
                </button>
                <button type="button" className={styles.ghost} onClick={reset}>
                  Not now
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.row}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => void file()}
                disabled={busy || !text.trim()}
              >
                {busy ? 'Working' : 'File it'}
              </button>
              <button type="button" className={styles.ghost} onClick={reset} disabled={busy}>
                Clear
              </button>
            </div>
          )}

          {scribe ? <p className={styles.scribe}>{scribe}</p> : null}

          {offer ? (
            <p className={styles.offer}>
              There is a passage under that.{' '}
              <Link className={styles.offerLink} href="/bible" onClick={close}>
                {offer}
              </Link>
            </p>
          ) : null}

          <div className={styles.foot}>
            <button
              type="button"
              className={styles.mute}
              onClick={() => {
                setMuted((m) => !m);
                if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
              }}
            >
              {muted ? 'Voice off' : 'Voice on'}
            </button>
            <button type="button" className={styles.close} onClick={close}>
              Close
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
