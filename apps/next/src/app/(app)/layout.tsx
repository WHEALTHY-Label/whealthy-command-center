import { redirect } from 'next/navigation';
import { NavFrame } from '@/components/NavFrame';
import { getAuthedEmail } from '@/lib/auth/session';
import {
  fetchOnboardingState,
  gateDestination,
  isMember,
  type OnboardingState,
} from '@/lib/onboarding';

/**
 * Protected shell. The middleware already guarantees a session here; this
 * layer enforces MEMBERSHIP: a signed-in non-member (join/pending) is routed
 * to the correct gate and never sees protected content.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const email = await getAuthedEmail();
  if (!email) {
    redirect('/sign-in');
  }

  // Resolve the gate first, keeping the redirect calls OUT of the try/catch
  // (redirect() throws a control-flow signal that must not be swallowed).
  let state: OnboardingState | null = null;
  try {
    state = await fetchOnboardingState(email);
  } catch {
    state = null;
  }

  if (!state) {
    redirect('/sign-in');
  }
  if (!isMember(state.gate)) {
    redirect(gateDestination(state.gate));
  }

  return <NavFrame>{children}</NavFrame>;
}
