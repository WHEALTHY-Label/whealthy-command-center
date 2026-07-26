import { getAuthedEmail } from '@/lib/auth/session';
import { fetchRhythmStatus } from '@/lib/rhythm';
import { BuildFlow } from './BuildFlow';

/**
 * The builder reads state only. `rhythm-build` inserts a draft row on every
 * call, so drafting is an explicit tap inside `BuildFlow`, never a side effect
 * of rendering this page. An existing draft is resumed from the status read.
 */
export default async function RhythmBuildPage() {
  const email = await getAuthedEmail();
  if (!email) return null;

  const status = await fetchRhythmStatus(email);
  return <BuildFlow status={status} />;
}
