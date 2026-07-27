import 'server-only';
import { cache } from 'react';
import { getAuthedEmail } from '@/lib/auth/session';
import { getPublicEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { fetchMemberProfile } from '@/lib/tour';

export type FnResult =
  | { ok: true; status: number; data: Record<string, unknown> }
  | { ok: false; status: number; code: string; data: Record<string, unknown> };

function anonHeaders() {
  const env = getPublicEnv();
  return {
    'content-type': 'application/json',
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  };
}

/**
 * Call an email-gated edge function as the signed-in member.
 *
 * The deployed functions read identity from either the `?email=` query string
 * (rhythm family) or an `email` field in the body (prayer, circle, governor
 * families), so both carry the validated session email. Client input never
 * reaches either one.
 */
export async function memberFn(slug: string, body?: Record<string, unknown>): Promise<FnResult> {
  const email = await getAuthedEmail();
  if (!email) return { ok: false, status: 401, code: 'not_signed_in', data: {} };
  const env = getPublicEnv();
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_FN_BASE}/${slug}?email=${encodeURIComponent(email)}`,
      {
        method: 'POST',
        headers: anonHeaders(),
        cache: 'no-store',
        body: JSON.stringify({ ...(body ?? {}), email }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: typeof data.error === 'string' ? data.error : '',
        data,
      };
    }
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, code: '', data: {} };
  }
}

/** GET variant for the read-only functions that accept query input. */
export async function memberFnGet(slug: string, query: string): Promise<FnResult> {
  const email = await getAuthedEmail();
  if (!email) return { ok: false, status: 401, code: 'not_signed_in', data: {} };
  const env = getPublicEnv();
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_FN_BASE}/${slug}?email=${encodeURIComponent(email)}${query ? `&${query}` : ''}`,
      { headers: anonHeaders(), cache: 'no-store' },
    );
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: typeof data.error === 'string' ? data.error : '',
        data,
      };
    }
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, code: '', data: {} };
  }
}

export interface MemberContext {
  email: string;
  memberId: number;
  name: string;
}

/**
 * The wall family keys writes by numeric `member_id`, not email. Resolve it
 * once per request through `verify-member`.
 *
 * Not from the table: `approved_members` has row level security on with no
 * SELECT policy and no grant to `authenticated`, so the session-scoped select
 * this used to do raised `42501 permission denied` for every signed-in member.
 * The error branch was taken every single time, which is why affiliate link
 * generation reported "Not signed in." to a signed-in steward and every
 * member-id-keyed wall write refused.
 */
export const getMemberContext = cache(async (): Promise<MemberContext | null> => {
  const email = await getAuthedEmail();
  if (!email) return null;
  const profile = await fetchMemberProfile(email);
  if (profile.memberId === null) return null;
  return { email, memberId: profile.memberId, name: profile.name };
});

/**
 * Call a function that takes its identity from the caller's Supabase JWT
 * rather than from an email in the payload. Two families need this: the
 * admin-* functions, which check `approved_members.admin_role`, and
 * `tour-state`, which resolves the member from `auth.getUser(token)`.
 *
 * The anon key is never enough for either, so a missing session short-circuits
 * to a 401 instead of firing an anonymous request.
 */
export async function sessionFn(
  slug: string,
  body?: Record<string, unknown>,
  method: 'POST' | 'GET' = 'POST',
): Promise<FnResult> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, status: 401, code: 'no_token', data: {} };
  const env = getPublicEnv();
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_FN_BASE}/${slug}`, {
      method,
      headers: {
        'content-type': 'application/json',
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: typeof data.error === 'string' ? data.error : '',
        data,
      };
    }
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, code: '', data: {} };
  }
}

/** Admin functions authenticate exactly the same way. Kept as a named alias so
 * admin call sites still read as admin-scoped. */
export const adminFn = sessionFn;

/**
 * Call a function that is deliberately unauthenticated. Two qualify:
 * `verify-member`, the profile read, and `add-member`, the quiz submission.
 * Both take a plain body and are only ever called from the server, so any
 * email in that body is the validated session email, never client input.
 */
export async function publicFn(slug: string, body: Record<string, unknown>): Promise<FnResult> {
  const env = getPublicEnv();
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_FN_BASE}/${slug}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: typeof data.error === 'string' ? data.error : '',
        data,
      };
    }
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, code: '', data: {} };
  }
}
