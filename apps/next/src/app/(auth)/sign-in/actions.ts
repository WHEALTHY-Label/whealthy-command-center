'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { describeAuthError } from '@/lib/auth-errors';
import { fetchOnboardingState, gateDestination } from '@/lib/onboarding';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function normalizeEmail(raw: FormDataEntryValue | null): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

/** Step 1: send a one-time code to the email. */
export async function sendCode(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = normalizeEmail(formData.get('email'));
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    return { ok: false, error: describeAuthError(error.message, error.status) };
  }
  return { ok: true };
}

/**
 * Step 2: verify the code, establish the session, then branch on the
 * membership gate and route accordingly.
 */
export async function verifyCode(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = normalizeEmail(formData.get('email'));
  const token = String(formData.get('token') ?? '').trim();
  if (!token) {
    return { ok: false, error: 'Enter the code from your email.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) {
    return { ok: false, error: 'That code did not work. Check it and try again.' };
  }

  let destination = '/join';
  try {
    const state = await fetchOnboardingState(email);
    destination = gateDestination(state.gate);
  } catch {
    // If the gate lookup fails, fall through to the safe non-member screen.
    destination = '/join';
  }

  redirect(destination);
}
