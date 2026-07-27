'use client';

import { useEffect, useRef } from 'react';

/**
 * Fires once, when an element has actually been looked at.
 *
 * "Looked at" means a majority of it has been inside the viewport
 * continuously for `dwellMs`. Scrolling past at speed does not count, because
 * the timer is cancelled the moment the element leaves. This is the honest
 * reading of "seen": the earlier version stamped every answered prayer the
 * moment the tab opened, so a member who tapped through and left had answers
 * marked read that never crossed the fold.
 *
 * Returns a ref to attach to the element to watch. The callback is held in a
 * ref of its own, so an inline arrow function does not tear down the observer
 * on every render.
 */
export function useSeenOnDwell(
  active: boolean,
  onSeen: () => void,
  dwellMs = 1500,
): React.RefObject<HTMLElement | null> {
  const hostRef = useRef<HTMLElement | null>(null);
  const firedRef = useRef(false);
  const onSeenRef = useRef(onSeen);

  useEffect(() => {
    onSeenRef.current = onSeen;
  });

  useEffect(() => {
    if (!active || firedRef.current) return;
    const host = hostRef.current;
    if (!host) return;

    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      onSeenRef.current();
    };

    // No observer means an old browser, not a member who read nothing. Fall
    // back to a plain dwell so the badge still settles for them.
    if (typeof IntersectionObserver === 'undefined') {
      const id = setTimeout(fire, dwellMs);
      return () => clearTimeout(id);
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (entry.isIntersecting) {
          timer ??= setTimeout(() => {
            observer.disconnect();
            fire();
          }, dwellMs);
        } else if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      },
      // Most of the card, not a sliver of its edge.
      { threshold: 0.6 },
    );
    observer.observe(host);

    return () => {
      if (timer !== null) clearTimeout(timer);
      observer.disconnect();
    };
  }, [active, dwellMs]);

  return hostRef;
}
