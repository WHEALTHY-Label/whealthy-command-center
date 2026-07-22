import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { getAdminRole, getAuthedEmail } from '@/lib/auth/session';
import {
  fetchOnboardingState,
  gateDestination,
  isMember,
  type OnboardingState,
} from '@/lib/onboarding';
import styles from './layout.module.css';

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

  // Resolve the gate first, keeping redirect() calls OUT of the try/catch
  // (redirect throws a control-flow signal that must not be swallowed).
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

  const role = await getAdminRole();

  return (
    <div className={styles.shell}>
      <Sidebar isAdmin={role !== null} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
