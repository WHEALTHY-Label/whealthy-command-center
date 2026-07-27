'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './wizard.module.css';

/**
 * Press and hold, reproducing the live app's holdBind: a pointerdown starts a
 * requestAnimationFrame loop that drives a fill bar to 100% over `ms`, and
 * pointerup, pointerleave or pointercancel aborts and resets the fill to 0%.
 * A latch makes the callback fire exactly once. Haptics fire on start and on
 * completion where the device supports them.
 *
 * Keyboard is a first-class path, not an afterthought: holding Enter or Space
 * runs the same timer, so the gate is reachable without a pointer.
 */
export function HoldButton({
  label,
  ms = 900,
  onComplete,
  disabled = false,
}: {
  label: string;
  ms?: number;
  onComplete: () => void;
  disabled?: boolean;
}) {
  const fillRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const holdingRef = useRef(false);
  const [done, setDone] = useState(false);

  const paint = useCallback((pct: number) => {
    const el = fillRef.current;
    if (el) el.style.width = `${pct}%`;
  }, []);

  const cancel = useCallback(() => {
    holdingRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    if (!doneRef.current) paint(0);
  }, [paint]);

  // Any unmount mid-hold must not leave a frame loop running.
  useEffect(() => cancel, [cancel]);

  const buzz = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  }, []);

  const start = useCallback(() => {
    if (disabled || doneRef.current || holdingRef.current) return;
    holdingRef.current = true;
    startRef.current = null;
    buzz(8);
    const frame = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / ms);
      paint(p * 100);
      if (p >= 1) {
        doneRef.current = true;
        holdingRef.current = false;
        rafRef.current = null;
        buzz([12, 50, 16]);
        setDone(true);
        onComplete();
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [buzz, disabled, ms, onComplete, paint]);

  return (
    <button
      type="button"
      className={done ? `${styles.hold} ${styles.holdDone}` : styles.hold}
      disabled={disabled}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') cancel();
      }}
      onBlur={cancel}
    >
      <i className={styles.holdFill} ref={fillRef} aria-hidden="true" />
      <span className={styles.holdLabel}>{label}</span>
    </button>
  );
}
