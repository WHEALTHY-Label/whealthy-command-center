'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { markTourDone } from '@/lib/actions/tour';
import { buildTourSteps, type TourContext } from '@/lib/tour';
import styles from './tour.module.css';

/** Dispatch this to open the tour from anywhere (the checklist footer link). */
export const TOUR_START_EVENT = 'whealthy:tour-start';

const MOBILE_QUERY = '(max-width: 768px)';
const AUTOSTART_DELAY = 1500;
const CARD_WIDTH = 380;
const GUTTER = 16;

interface Position {
  top: number;
  left: number;
}

export function TourOverlay({
  context,
  tourDoneAt,
}: {
  context: TourContext;
  tourDoneAt: string | null;
}) {
  const steps = useMemo(() => buildTourSteps(context), [context]);
  const [index, setIndex] = useState<number | null>(null);
  const [pos, setPos] = useState<Position | null>(null);
  const [mobile, setMobile] = useState(false);
  const spotlit = useRef<Element | null>(null);

  const open = index !== null;
  const step = index === null ? null : steps[index];

  const clearSpotlight = useCallback(() => {
    if (spotlit.current) {
      spotlit.current.classList.remove(styles.spotlight!);
      spotlit.current = null;
    }
  }, []);

  const close = useCallback(
    (completed: boolean) => {
      clearSpotlight();
      setIndex(null);
      setPos(null);
      document.body.style.removeProperty('overflow');
      // Either ending counts as walking the house: the live app wrote
      // tour_done_at on skip as well, and the column is coalesce-guarded so
      // only the first write lands.
      void markTourDone().catch(() => {});
      if (completed) window.dispatchEvent(new CustomEvent('whealthy:tour-finished'));
    },
    [clearSpotlight],
  );

  // Track the breakpoint the card layout switches on. Kept in JS as well as
  // CSS because the desktop branch measures and positions the card.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const apply = () => setMobile(mq.matches);
    const id = window.setTimeout(apply, 0);
    mq.addEventListener('change', apply);
    return () => {
      window.clearTimeout(id);
      mq.removeEventListener('change', apply);
    };
  }, []);

  // Auto-start once for a member who has never walked it, and listen for the
  // explicit retake.
  useEffect(() => {
    const start = () => setIndex(0);
    window.addEventListener(TOUR_START_EVENT, start);
    let id = 0;
    if (!tourDoneAt) id = window.setTimeout(start, AUTOSTART_DELAY);
    return () => {
      window.removeEventListener(TOUR_START_EVENT, start);
      if (id) window.clearTimeout(id);
    };
  }, [tourDoneAt]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i === null) return null;
      return i + 1 >= steps.length ? null : i + 1;
    });
  }, [steps.length]);

  const advance = useCallback(() => {
    if (index === null) return;
    if (index + 1 >= steps.length) {
      close(true);
      return;
    }
    next();
  }, [close, index, next, steps.length]);

  const back = useCallback(() => {
    setIndex((i) => (i === null || i <= 0 ? i : i - 1));
  }, []);

  // Spotlight the target and place the card. Measurement happens in a frame
  // callback so nothing is read or set during render.
  useEffect(() => {
    if (!open || !step) return;
    clearSpotlight();
    document.body.style.overflow = 'hidden';

    if (!step.target || mobile) {
      const id = window.requestAnimationFrame(() => setPos(null));
      return () => window.cancelAnimationFrame(id);
    }

    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      const id = window.requestAnimationFrame(() => setPos(null));
      return () => window.cancelAnimationFrame(id);
    }
    el.classList.add(styles.spotlight!);
    spotlit.current = el;
    el.scrollIntoView({ block: 'nearest' });

    const place = () => {
      const r = el.getBoundingClientRect();
      const left = Math.min(r.right + GUTTER, window.innerWidth - CARD_WIDTH - GUTTER);
      const top = Math.max(
        GUTTER,
        Math.min(r.top - 8, window.innerHeight - 260 - GUTTER),
      );
      setPos({ top, left: Math.max(GUTTER, left) });
    };
    const frame = window.requestAnimationFrame(place);

    let debounce = 0;
    const onResize = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(place, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(debounce);
      window.removeEventListener('resize', onResize);
    };
  }, [open, step, mobile, clearSpotlight]);

  // Keyboard: the same bindings the live tour used.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        advance();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, advance, back, close]);

  useEffect(() => {
    return () => {
      document.body.style.removeProperty('overflow');
    };
  }, []);

  if (!open || !step || index === null) return null;

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  return (
    <>
      <div className={styles.dim} aria-hidden="true" />
      <div
        className={`${styles.card} ${mobile || !pos ? styles.cardCentered : ''}`}
        style={pos && !mobile ? { top: pos.top, left: pos.left } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
      >
        <p className={styles.count}>
          {index + 1} of {steps.length}
        </p>
        <h2 className={styles.title}>{step.title}</h2>
        <p className={styles.body}>{step.body}</p>
        <div className={styles.actions}>
          {step.skipLabel !== null ? (
            <button type="button" className={styles.ghost} onClick={() => close(false)}>
              {step.skipLabel ?? 'Skip tour'}
            </button>
          ) : (
            <span />
          )}
          <div className={styles.right}>
            {!isFirst && !isLast ? (
              <button type="button" className={styles.ghost} onClick={back}>
                Back
              </button>
            ) : null}
            <button type="button" className={styles.primary} onClick={advance}>
              {step.nextLabel ?? 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
