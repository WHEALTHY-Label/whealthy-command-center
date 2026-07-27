import { cache } from 'react';
import { addDaysIso, chicagoDate } from '@/lib/day';

/**
 * What day it is, in the steward's calendar: America/Chicago.
 *
 * The live app answered this question with `realToday()` (index.html:12697),
 * which formats through `Intl.DateTimeFormat` with `timeZone: 'America/Chicago'`,
 * and every deployed edge function that dates a row carries its own
 * `toChicagoDate`. A UTC date rolls over five hours early (six in winter), so a
 * steward filing tonight's entry at 9pm was writing tomorrow's row and reading
 * a fast day one ahead of the one he was living.
 *
 * The clock read lives here rather than in a page body for two reasons. The
 * `react-hooks/purity` rule bars a `Date.now()` call during render, even inside
 * an async Server Component. And `cache()` pins one answer for the whole
 * request, so a page that asks twice cannot straddle midnight and render a day
 * count that disagrees with its own heading.
 */
export const chicagoToday = cache((): string => chicagoDate(Date.now()));

/**
 * Tomorrow in America/Chicago.
 *
 * The fast wizard defaults its start date here, which is what the live app did:
 * `dayKey(1)` at index.html:16452 (the date input), 16649 (the forge prompt) and
 * 16733 (the row that gets written). A fast is something a steward commits to
 * before it begins, so the default is the next sunrise, not this one.
 */
export const chicagoTomorrow = cache((): string => addDaysIso(chicagoToday(), 1));
