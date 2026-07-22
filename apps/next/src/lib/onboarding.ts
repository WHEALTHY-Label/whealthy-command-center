import { getPublicEnv } from '@/lib/env';

/**
 * The single gate value from `onboarding-state` that drives where a member
 * goes next. Mirrors the live app exactly.
 *   join    — not in the roster (non-member)
 *   pending — requested access, awaiting admin approval (non-member)
 *   quiz    — member, no archetype yet
 *   bundle  — member, quiz done, no bundle set up
 *   ready   — member, fully set up
 */
export type Gate = 'join' | 'pending' | 'quiz' | 'bundle' | 'ready';

export interface OnboardingState {
  ok: boolean;
  verified: boolean;
  gate: Gate;
  message?: string;
  skool_url?: string;
  exclusive?: boolean;
  discount_pct?: number;
  discount_code?: string;
}

const MEMBER_GATES: ReadonlySet<Gate> = new Set<Gate>(['quiz', 'bundle', 'ready']);

/** True when the gate corresponds to an approved member who may enter the app. */
export function isMember(gate: Gate): boolean {
  return MEMBER_GATES.has(gate);
}

/**
 * Where a given gate should route. Non-members go to the join/pending
 * screens; members go to their next onboarding step (destinations are
 * placeholders until their own slices).
 */
export function gateDestination(gate: Gate): string {
  switch (gate) {
    case 'join':
      return '/join';
    case 'pending':
      return '/pending';
    case 'quiz':
      return '/quiz';
    case 'bundle':
      return '/bundle';
    case 'ready':
      return '/';
  }
}

/** Narrow an arbitrary string to a known Gate, defaulting to the safest (join). */
export function toGate(value: unknown): Gate {
  return value === 'pending' ||
    value === 'quiz' ||
    value === 'bundle' ||
    value === 'ready' ||
    value === 'join'
    ? value
    : 'join';
}

/**
 * Fetch the onboarding state for an email. The email MUST come from the
 * server-validated session, never from client input.
 */
export async function fetchOnboardingState(email: string): Promise<OnboardingState> {
  const env = getPublicEnv();
  const url = `${env.NEXT_PUBLIC_FN_BASE}/onboarding-state?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`onboarding-state failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    ok: data.ok === true,
    verified: data.verified === true,
    gate: toGate(data.gate),
    message: typeof data.message === 'string' ? data.message : undefined,
    skool_url: typeof data.skool_url === 'string' ? data.skool_url : undefined,
    exclusive: typeof data.exclusive === 'boolean' ? data.exclusive : undefined,
    discount_pct: typeof data.discount_pct === 'number' ? data.discount_pct : undefined,
    discount_code: typeof data.discount_code === 'string' ? data.discount_code : undefined,
  };
}
