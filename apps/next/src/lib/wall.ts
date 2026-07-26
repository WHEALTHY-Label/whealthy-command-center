/**
 * Wall post parsing against the deployed `wall-read`/`wall-post` serializer.
 *
 * The serializer's exact field names (verified in the deployed source):
 * id, body, status, pray_count, amen_count, created_at, answered_at,
 * answered_note, answered_note_locked_at, display_mode, is_mine,
 * pray_count_frozen, prays_remaining_today, author{name, avatar_url},
 * has_amened (answered posts only), has_unseen_answer (RPC views only).
 */

export type WallStatus = 'live' | 'answered' | 'archived' | 'held';

export interface WallPost {
  id: string;
  body: string;
  status: WallStatus;
  prayCount: number;
  amenCount: number;
  createdAt: string | null;
  answeredAt: string | null;
  answeredNote: string | null;
  answeredNoteLockedAt: string | null;
  displayMode: 'anonymous' | 'signed';
  isMine: boolean;
  prayCountFrozen: boolean;
  praysRemainingToday: number;
  authorName: string;
  authorAvatar: string | null;
  hasAmened: boolean;
  hasUnseenAnswer: boolean;
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function parseWallPost(raw: unknown): WallPost | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = r.id;
  if (id === undefined || id === null) return null;
  const status = str(r.status);
  const author =
    typeof r.author === 'object' && r.author !== null ? (r.author as Record<string, unknown>) : {};
  return {
    id: String(id),
    body: str(r.body) ?? '',
    status:
      status === 'answered' || status === 'archived' || status === 'held'
        ? status
        : 'live',
    prayCount: num(r.pray_count),
    amenCount: num(r.amen_count),
    createdAt: str(r.created_at),
    answeredAt: str(r.answered_at),
    answeredNote: str(r.answered_note),
    answeredNoteLockedAt: str(r.answered_note_locked_at),
    displayMode: r.display_mode === 'signed' ? 'signed' : 'anonymous',
    isMine: r.is_mine === true,
    prayCountFrozen: r.pray_count_frozen === true,
    // The serializer only includes this on live posts; 3 is the daily cap.
    praysRemainingToday: num(r.prays_remaining_today, 3),
    authorName: str(author.name) ?? 'A Steward',
    authorAvatar: str(author.avatar_url),
    hasAmened: r.has_amened === true,
    hasUnseenAnswer: r.has_unseen_answer === true,
  };
}

/** List views answer `{posts: [...]}`; `single` answers the bare post. */
export function parseWallList(data: unknown): WallPost[] {
  if (typeof data !== 'object' || data === null) return [];
  const posts = (data as Record<string, unknown>).posts;
  if (!Array.isArray(posts)) return [];
  return posts.map(parseWallPost).filter((p): p is WallPost => p !== null);
}

/** "just now" / "Nm ago" / "Nh ago" / "Nd ago", matching the live app. */
export function relativeTime(iso: string | null, nowMs: number): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((nowMs - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** "Asked Jul 3 · Answered Jul 9 · 6 days" testimony time track. */
export function testimonyTrack(createdAt: string | null, answeredAt: string | null): string {
  if (!createdAt || !answeredAt) return '';
  const asked = new Date(createdAt);
  const answered = new Date(answeredAt);
  if (Number.isNaN(asked.getTime()) || Number.isNaN(answered.getTime())) return '';
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const days = Math.round((answered.getTime() - asked.getTime()) / 86400000);
  const elapsed = days <= 0 ? 'Same day' : days === 1 ? '1 day' : `${days} days`;
  return `Asked ${fmt(asked)} · Answered ${fmt(answered)} · ${elapsed}`;
}

/** Whole hours left in the 24h answered-note edit window, 0 when closed. */
export function editHoursLeft(lockedAtIso: string | null, nowMs: number): number {
  if (!lockedAtIso) return 0;
  const lockAt = Date.parse(lockedAtIso);
  if (Number.isNaN(lockAt)) return 0;
  return Math.max(0, Math.ceil((lockAt - nowMs) / 3600000));
}
