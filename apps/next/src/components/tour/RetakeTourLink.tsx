'use client';

import { TOUR_START_EVENT } from './TourOverlay';
import styles from './tour.module.css';

/** The checklist footer entry point. The overlay lives in the app layout and
 * listens for this event, so the two do not need to share a parent. */
export function RetakeTourLink() {
  return (
    <button
      type="button"
      className={styles.retake}
      onClick={() => window.dispatchEvent(new CustomEvent(TOUR_START_EVENT))}
    >
      Retake the tour
    </button>
  );
}
