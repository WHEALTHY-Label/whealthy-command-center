'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchDashPersonalization } from '@/lib/actions/personalize';
import {
  allowCommunityDirective,
  mentionsWall,
  timeGreeting,
  type Personalization,
} from '@/lib/personalize';

/**
 * One `synthesis` call per page load, shared by every surface that renders its
 * result.
 *
 * The live app fetched this once at boot (`setTimeout(waFetchAIPersonalization,
 * 150)` at index.html:18351), parked it on `window.aiPersonalizations`, and
 * every later view switch read it back through `personalizePageHeader(view)`.
 * A provider in the protected layout is the same shape: the layout does not
 * remount across client-side navigation, so walking from Home to My Journal to
 * The Fast reads one answer rather than asking three times.
 *
 * The one departure is that the call is made on demand rather than
 * unconditionally at boot. Legacy asked the model even when the steward opened
 * straight into a view whose header the answer could not change. Here a surface
 * that will actually render the copy calls `request()`, so opening the orders
 * portal costs nothing. Nothing visible differs; only the bill does.
 */

/** The legacy key, so a steward who used the old app keeps their spacing. */
const NUDGE_KEY = 'wh_daily_comm_nudge_shown_at';

function readNudge(): string | null {
  try {
    return window.localStorage.getItem(NUDGE_KEY);
  } catch {
    // Storage blocked. Treat it as never nudged rather than losing the call.
    return null;
  }
}

function stampNudge(iso: string): void {
  try {
    window.localStorage.setItem(NUDGE_KEY, iso);
  } catch {
    // A blocked write only costs the five day spacing, not the directive.
  }
}

export interface PersonalState {
  /** What the model said, or null until it has said anything. */
  ai: Personalization | null;
  /**
   * The steward's own time-of-day greeting. Read after mount because the hour
   * is the one fact the server cannot know, and because `react-hooks/purity`
   * bars a clock read during render.
   */
  greeting: string | null;
  /** Ask for the personalization. Safe to call from several surfaces at once. */
  request: () => void;
}

const Ctx = createContext<PersonalState>({
  ai: null,
  greeting: null,
  request: () => {},
});

/** The shared personalization, without asking for it. */
export function usePersonalization(): PersonalState {
  return useContext(Ctx);
}

/**
 * The shared personalization, asking for it on mount. Use this from anything
 * that renders the model's copy; use `usePersonalization` from anything that
 * only wants it if some other surface already asked.
 */
export function useRequestedPersonalization(): PersonalState {
  const state = useContext(Ctx);
  const { request } = state;
  useEffect(() => {
    request();
  }, [request]);
  return state;
}

export function PersonalizationProvider({ children }: { children: React.ReactNode }) {
  const [ai, setAi] = useState<Personalization | null>(null);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [wanted, setWanted] = useState(false);

  const request = useCallback(() => {
    setWanted(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setGreeting(timeGreeting(new Date().getHours())), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    // The live app's own 150ms delay, so the first paint is never held up by a
    // model call the steward did not ask for.
    const timer = setTimeout(() => {
      void (async () => {
        const now = Date.now();
        const result = await fetchDashPersonalization(
          new Date(now).getHours(),
          allowCommunityDirective(readNudge(), now),
        );
        if (!alive || !result.ok || !result.personalization) return;
        setAi(result.personalization);
        // Only a directive that actually mentioned the wall spends the nudge.
        if (mentionsWall(result.personalization.dailyDirective)) {
          stampNudge(new Date(Date.now()).toISOString());
        }
      })();
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [wanted]);

  const value = useMemo<PersonalState>(() => ({ ai, greeting, request }), [ai, greeting, request]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
