'use server';

import { getPublicEnv } from '@/lib/env';

export interface RequestResult {
  ok: boolean;
  pending?: boolean;
  alreadyMember?: boolean;
  message?: string;
  error?: string;
}

/** Submit an access request for a Stewards member awaiting approval. */
export async function requestAccess(
  _prev: RequestResult,
  formData: FormData,
): Promise<RequestResult> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const env = getPublicEnv();
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_FN_BASE}/request-access`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store',
      body: JSON.stringify({ email, name: name || undefined }),
    });
    if (!res.ok) {
      return { ok: false, error: 'Could not submit your request. Please try again.' };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      pending: data.status === 'pending',
      alreadyMember: data.already_member === true,
      message: typeof data.message === 'string' ? data.message : undefined,
    };
  } catch {
    return { ok: false, error: 'Could not submit your request. Please try again.' };
  }
}
