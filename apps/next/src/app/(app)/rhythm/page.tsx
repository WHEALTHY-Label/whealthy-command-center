import { getAuthedEmail } from '@/lib/auth/session';
import { getPublicEnv } from '@/lib/env';
import { fetchRhythmStatus } from '@/lib/rhythm';
import { RhythmDay } from './RhythmDay';

export default async function RhythmPage() {
  const email = await getAuthedEmail();
  if (!email) return null;

  const status = await fetchRhythmStatus(email);
  const env = getPublicEnv();
  const icsUrl = status.icsToken
    ? `${env.NEXT_PUBLIC_FN_BASE}/rhythm-feed?token=${encodeURIComponent(status.icsToken)}`
    : null;

  return <RhythmDay status={status} icsUrl={icsUrl} />;
}
