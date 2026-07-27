'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { reportFirstStep } from '@/lib/actions/tour';
import { stepForPath } from '@/lib/tour';

/**
 * Completes a First Step by arriving in the room, which is exactly how the
 * live app behaved: the only call site was inside `go()`.
 *
 * Two guards keep this quiet. `done` holds the flags the server already has,
 * so a returning member never writes again, and `sent` holds what this tab has
 * written, so a re-render or a back-and-forth between two rooms does not
 * re-post. A failed write leaves both unset, so the next visit retries.
 */
export function FirstStepReporter({ done }: { done: Record<string, boolean> }) {
  const pathname = usePathname();
  const router = useRouter();
  const sent = useRef<Set<string>>(new Set());

  useEffect(() => {
    const key = stepForPath(pathname ?? '');
    if (!key) return;
    if (done[key] === true) return;
    if (sent.current.has(key)) return;
    sent.current.add(key);
    let cancelled = false;
    void reportFirstStep(key)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          sent.current.delete(key);
          return;
        }
        // The dashboard renders progress from the server flags, so refresh it
        // rather than holding a second copy of the truth on the client.
        router.refresh();
      })
      .catch(() => {
        if (!cancelled) sent.current.delete(key);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, done, router]);

  return null;
}
