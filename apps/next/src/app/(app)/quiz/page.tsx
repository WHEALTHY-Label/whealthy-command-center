import { redirect } from 'next/navigation';
import { getAuthedEmail } from '@/lib/auth/session';
import { fetchMemberProfile } from '@/lib/tour';
import { QuizFlow } from './QuizFlow';

/**
 * The Steward Pattern assessment.
 *
 * The gate in `(app)/layout.tsx` routes an unscored member here. A member who
 * has already been scored is sent on rather than allowed to overwrite their
 * pattern by accident; `add-member` merges rather than clears, but the reveal
 * copy only makes sense the first time.
 */
export default async function QuizPage() {
  const email = await getAuthedEmail();
  if (!email) return null;

  const profile = await fetchMemberProfile(email);
  if (profile.archetype) {
    redirect('/');
  }

  return <QuizFlow firstName={profile.firstName} />;
}
