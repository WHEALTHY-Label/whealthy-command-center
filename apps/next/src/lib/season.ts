import type { Season } from './rhythm';

/**
 * The only lengths `rhythm-season` accepts. Anything else comes back as
 * `bad_length`, so the offer is clamped to these before it is ever rendered.
 */
export const SEASON_LENGTHS = [21, 40, 90] as const;
export type SeasonLength = (typeof SEASON_LENGTHS)[number];

/** Narrow an arbitrary number to a length the server will take. Pure. */
export function isSeasonLength(value: unknown): value is SeasonLength {
  return typeof value === 'number' && (SEASON_LENGTHS as readonly number[]).includes(value);
}

/**
 * What the function offered, filtered to what it will actually accept. A newer
 * deploy could widen the list, so the response is preferred over the constant,
 * but a length the server would reject never reaches a button.
 */
export function seasonOptions(season: Season): SeasonLength[] {
  const offered = season.options?.filter(isSeasonLength) ?? [];
  return offered.length > 0 ? offered : [...SEASON_LENGTHS];
}

/** Percent of the season carried, clamped for the progress bar. Pure. */
export function seasonProgress(day: number | undefined, total: number | undefined): number {
  if (!day || !total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((day / total) * 100)));
}

/**
 * The line under a running season. Days remaining, never a streak: a missed
 * day costs nothing here, the count is of days the season still holds.
 */
export function daysLeftLine(daysLeft: number | undefined): string {
  if (daysLeft === undefined) return '';
  if (daysLeft <= 0) return 'Last day.';
  if (daysLeft === 1) return '1 day left';
  return `${daysLeft} days left`;
}

export type SeasonView =
  | { kind: 'none' }
  | { kind: 'offer'; options: SeasonLength[]; line: string }
  | {
      kind: 'running';
      label: string;
      day: number;
      total: number;
      percent: number;
      leftLine: string;
      /** A fast is ended in the Fast, not here. */
      canEnd: boolean;
      withCohort: boolean;
    }
  | { kind: 'complete'; line: string; canEnd: boolean };

const OFFER_LINE = 'Name a season and carry it. Twenty-one days, forty, or ninety.';

/**
 * Turn the season block into exactly one of the four things the strip can show.
 * `source` is checked before `canCommit` because the function drops
 * `can_commit` once a season is running, which would otherwise read as an
 * invitation to start a second one. Pure.
 */
export function seasonView(season: Season): SeasonView {
  const canEnd = season.source === 'rhythm';

  if (season.source && season.completed) {
    const total = season.total;
    return {
      kind: 'complete',
      line: total
        ? `You finished your ${total}-day season. Well carried.`
        : 'You finished your season. Well carried.',
      canEnd,
    };
  }

  if (season.source && season.day && season.total) {
    return {
      kind: 'running',
      label: season.label ?? `Your ${season.total}-day season`,
      day: season.day,
      total: season.total,
      percent: seasonProgress(season.day, season.total),
      leftLine: daysLeftLine(season.daysLeft),
      canEnd,
      withCohort: Boolean(season.cohortId),
    };
  }

  if (!season.source && season.canCommit) {
    return { kind: 'offer', options: seasonOptions(season), line: OFFER_LINE };
  }

  return { kind: 'none' };
}
