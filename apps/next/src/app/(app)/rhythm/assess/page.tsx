import { getAuthedEmail } from '@/lib/auth/session';
import { fetchOnboardingState } from '@/lib/onboarding';
import { fetchRhythmStatus } from '@/lib/rhythm';
import { AssessFlow } from './AssessFlow';
import { SeasonThreshold } from './SeasonThreshold';

export default async function AssessPage() {
  const email = await getAuthedEmail();
  if (!email) return null;

  const [status, onboarding] = await Promise.all([
    fetchRhythmStatus(email),
    fetchOnboardingState(email),
  ]);

  // `rhythm-status` is the primary signal; the onboarding gate is a second
  // opinion so a hiccup in one read never sends a quiz-complete steward back
  // to the threshold.
  const hasQuiz =
    status.hasQuiz ||
    onboarding.gate === 'bundle' ||
    onboarding.gate === 'ready' ||
    Boolean(onboarding.archetype);

  return hasQuiz ? <AssessFlow /> : <SeasonThreshold />;
}
