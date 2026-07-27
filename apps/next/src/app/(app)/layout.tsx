import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { GovernorDock } from '@/components/governor/GovernorDock';
import { FirstStepReporter } from '@/components/tour/FirstStepReporter';
import { TourOverlay } from '@/components/tour/TourOverlay';
import { getAdminRole, getAuthedEmail } from '@/lib/auth/session';
import {
  fetchOnboardingState,
  gateDestination,
  isMember,
  type OnboardingState,
} from '@/lib/onboarding';
import { fetchMemberProfile, firstUncheckedLabel, prettyArchetype } from '@/lib/tour';
import { PersonalizationProvider } from './PersonalizationProvider';
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

  const [role, profile] = await Promise.all([getAdminRole(), fetchMemberProfile(email)]);

  // `verify-member` is the richer row, but a member scored through the
  // onboarding path can carry the name on the gate state alone. Key off
  // whether the profile is actually scored rather than off the display string,
  // so a scored steward is never greeted as "Steward".
  const archetypeName = profile.archetype
    ? profile.archetypeName
    : prettyArchetype(state.archetype_name ?? state.archetype ?? null);

  return (
    // One `synthesis` answer for the whole session, the way the live app kept
    // it on `window.aiPersonalizations`. The layout survives client-side
    // navigation, so every surface below reads the same answer.
    <PersonalizationProvider>
      <div className={styles.shell}>
        <Sidebar isAdmin={role !== null} />
        <div className={styles.content}>{children}</div>
        <FirstStepReporter done={profile.firstSteps} />
        <GovernorDock />
        <TourOverlay
          tourDoneAt={profile.tourDoneAt}
          context={{
            firstName: profile.firstName,
            archetypeName,
            bundleClaimed: state.bundle_claimed === true,
            fastActive: false,
            fastDay: 0,
            fastDuration: 0,
            isAdmin: role !== null,
            wordDay: '',
            firstUnchecked: firstUncheckedLabel(profile.firstSteps),
          }}
        />
      </div>
    </PersonalizationProvider>
  );
}
