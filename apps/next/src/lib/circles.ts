/**
 * Circle and cohort parsing against the deployed contracts.
 *
 * circle-day: { circle:<name>|null, circle_id, invite_code, today,
 *   members: [{ member_id, name, role, word, prayer, fast(bool|null),
 *   record, i_prayed_count }] }
 * cohort-board: { cohort:<name>, day, of, status,
 *   members: [{ name, days_kept }] }
 */

export interface CircleMember {
  memberId: number;
  name: string;
  role: string;
  word: boolean;
  prayer: boolean;
  /** null = no active fast (renders as a dash, not a miss). */
  fast: boolean | null;
  record: boolean;
  iPrayedCount: number;
}

export interface CircleDay {
  name: string;
  circleId: string;
  inviteCode: string;
  members: CircleMember[];
}

export function parseCircleDay(data: unknown): CircleDay | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (!d.circle) return null;
  const rawMembers = Array.isArray(d.members) ? d.members : [];
  return {
    name: String(d.circle),
    circleId: d.circle_id === undefined || d.circle_id === null ? '' : String(d.circle_id),
    inviteCode: typeof d.invite_code === 'string' ? d.invite_code : '',
    members: rawMembers
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .map((m) => ({
        memberId: typeof m.member_id === 'number' ? m.member_id : -1,
        name: typeof m.name === 'string' ? m.name : 'Steward',
        role: typeof m.role === 'string' ? m.role : 'member',
        word: m.word === true,
        prayer: m.prayer === true,
        fast: m.fast === null || m.fast === undefined ? null : m.fast === true,
        record: m.record === true,
        iPrayedCount: typeof m.i_prayed_count === 'number' ? m.i_prayed_count : 0,
      })),
  };
}

export interface CohortBoard {
  name: string;
  day: number;
  of: number;
  status: string;
  members: { name: string; daysKept: number }[];
}

export function parseCohortBoard(data: unknown): CohortBoard | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (!d.cohort) return null;
  const rawMembers = Array.isArray(d.members) ? d.members : [];
  return {
    name: String(d.cohort),
    day: typeof d.day === 'number' ? d.day : 0,
    of: typeof d.of === 'number' ? d.of : 0,
    status: typeof d.status === 'string' ? d.status : '',
    members: rawMembers
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .map((m) => ({
        name: typeof m.name === 'string' ? m.name : 'Steward',
        daysKept: typeof m.days_kept === 'number' ? m.days_kept : 0,
      })),
  };
}
