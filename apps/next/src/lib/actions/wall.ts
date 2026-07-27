'use server';

import { getMemberContext } from '@/lib/fn';
import { getPublicEnv } from '@/lib/env';
import { parseWallList, parseWallPost, type WallPost } from '@/lib/wall';

const GENERIC = 'That did not save. Please try again.';

type WallCall =
  | { ok: true; status: number; data: Record<string, unknown> }
  | { ok: false; status: number; message: string };

/**
 * The wall family keys the caller by numeric member_id in the body. The id
 * comes from the validated session's approved_members row, never the client.
 */
async function wallFn(slug: string, body: Record<string, unknown>): Promise<WallCall> {
  const ctx = await getMemberContext();
  if (!ctx) return { ok: false, status: 401, message: 'Not signed in.' };
  const env = getPublicEnv();
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_FN_BASE}/${slug}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store',
      body: JSON.stringify({ ...body, member_id: ctx.memberId }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: typeof data.error === 'string' ? data.error : GENERIC,
      };
    }
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, message: GENERIC };
  }
}

export interface WallListResult {
  ok: boolean;
  posts: WallPost[];
  error?: string;
}

const LIST_VIEWS = new Set([
  'bible365',
  'most_prayed',
  'needs_prayer',
  'testimony_top',
  'testimony_river',
  'my_prayers',
  'praying_for',
]);

export async function fetchWallView(
  view: string,
  cursor = 0,
  limit = 12,
): Promise<WallListResult> {
  if (!LIST_VIEWS.has(view)) return { ok: false, posts: [], error: 'Unknown view.' };
  const call = await wallFn('wall-read', {
    view,
    cursor: Math.max(0, Math.floor(cursor)),
    limit: Math.min(100, Math.max(1, Math.floor(limit))),
  });
  if (!call.ok) return { ok: false, posts: [], error: 'The wall did not load. Try again.' };
  return { ok: true, posts: parseWallList(call.data) };
}

/** The `single` view answers the bare post object, not {posts}. */
export async function fetchWallPost(postId: string): Promise<WallPost | null> {
  if (!postId) return null;
  const call = await wallFn('wall-read', { view: 'single', post_id: postId });
  if (!call.ok) return null;
  return parseWallPost(call.data);
}

export interface WallWriteResult {
  ok: boolean;
  error?: string;
  post?: WallPost | null;
  prayCount?: number;
  praysRemaining?: number;
  amenCount?: number;
  hasAmened?: boolean;
}

export async function postToWall(
  rawBody: string,
  displayMode: 'anonymous' | 'signed',
  source: 'wall' | 'bible365' = 'wall',
): Promise<WallWriteResult> {
  const body = rawBody.trim();
  if (body.length < 1 || body.length > 1000) {
    return { ok: false, error: 'Keep it between 1 and 1000 characters.' };
  }
  const call = await wallFn('wall-post', { body, display_mode: displayMode, source });
  if (!call.ok) {
    if (call.status === 429) {
      return {
        ok: false,
        error: 'You have brought three prayers to the wall today. More tomorrow.',
      };
    }
    return { ok: false, error: call.message };
  }
  return { ok: true, post: parseWallPost(call.data) };
}

export async function prayForPost(postId: string): Promise<WallWriteResult> {
  const call = await wallFn('wall-pray', { post_id: postId });
  if (!call.ok) {
    if (call.status === 429) {
      return { ok: false, error: 'Prayed three times today. Again tomorrow.' };
    }
    return { ok: false, error: call.message };
  }
  return {
    ok: true,
    prayCount: typeof call.data.pray_count === 'number' ? call.data.pray_count : undefined,
    praysRemaining:
      typeof call.data.prays_remaining_today === 'number'
        ? call.data.prays_remaining_today
        : undefined,
  };
}

export async function amenPost(postId: string): Promise<WallWriteResult> {
  const call = await wallFn('wall-amen', { post_id: postId });
  if (!call.ok) return { ok: false, error: call.message };
  return {
    ok: true,
    amenCount: typeof call.data.amen_count === 'number' ? call.data.amen_count : undefined,
    hasAmened: call.data.has_amened === true,
  };
}

/** One-way: the server refuses non-authors and already-signed posts. */
export async function signPost(postId: string): Promise<WallWriteResult> {
  const call = await wallFn('wall-sign', { post_id: postId });
  if (!call.ok) return { ok: false, error: call.message };
  return { ok: true, post: parseWallPost(call.data) };
}

export async function answerPost(postId: string, rawNote: string): Promise<WallWriteResult> {
  const note = rawNote.trim();
  if (note.length > 1000) return { ok: false, error: 'Keep the note under 1000 characters.' };
  const call = await wallFn('wall-answer', { post_id: postId, note });
  if (!call.ok) return { ok: false, error: call.message };
  return { ok: true, post: parseWallPost(call.data) };
}

export async function editAnswerNote(postId: string, rawNote: string): Promise<WallWriteResult> {
  const note = rawNote.trim();
  // No lower bound. The note is optional (MeClient.tsx labels the field
  // "(optional)") and the deployed `wall-answer-edit` writes null when it
  // receives an empty string, which is how a steward clears a note they no
  // longer want on an answered prayer. The old `< 1` guard made clearing
  // impossible: the only way out was to leave the old wording in place.
  if (note.length > 1000) {
    return { ok: false, error: 'Keep the note under 1000 characters.' };
  }
  const call = await wallFn('wall-answer-edit', { post_id: postId, note });
  if (!call.ok) {
    if (call.status === 409) return { ok: false, error: 'The edit window has closed.' };
    return { ok: false, error: call.message };
  }
  return { ok: true, post: parseWallPost(call.data) };
}

/**
 * The deployed function reads `reporter_id`, not member_id. The legacy
 * testimony screen sent member_id and silently failed; this sends the field
 * the function actually validates.
 */
export async function reportPost(postId: string, reason: string): Promise<WallWriteResult> {
  const ctx = await getMemberContext();
  if (!ctx) return { ok: false, error: 'Not signed in.' };
  const env = getPublicEnv();
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_FN_BASE}/wall-report`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store',
      body: JSON.stringify({
        reporter_id: ctx.memberId,
        post_id: postId,
        reason: reason.slice(0, 500) || 'Flagged by community',
      }),
    });
    if (!res.ok) return { ok: false, error: GENERIC };
    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

/** Stamp answered prayers as seen; only rows the member prayed for update. */
export async function markSeen(postId: string): Promise<void> {
  await wallFn('wall-seen', { post_id: postId });
}
