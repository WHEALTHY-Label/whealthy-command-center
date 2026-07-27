import 'server-only';
import { cache } from 'react';
import { memberFn, type FnResult } from '@/lib/fn';

/**
 * The `governor-state` load, fetched at most once per render pass.
 *
 * The rail now needs it too: the Claim Bundle "New" pulse keys off
 * `product_state` and the Fasting "DAY n" chip keys off the active fast, and
 * both live in the protected layout, which renders alongside every page that
 * was already loading the same payload. React's `cache()` collapses the layout
 * and the page below it into a single round trip.
 *
 * Read paths only. Write actions keep calling `memberFn` directly, because a
 * cached read taken before a write would hand back the pre-write row and the
 * screen would appear to have ignored what the steward just did.
 */
export const loadGovernorState = cache(
  (): Promise<FnResult> => memberFn('governor-state', { action: 'load' }),
);
