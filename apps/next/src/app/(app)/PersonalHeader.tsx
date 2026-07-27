import { getAuthedEmail } from '@/lib/auth/session';
import { fetchOnboardingState } from '@/lib/onboarding';
import { archetypeLabel, isAiHeaderView, pageHeader, stewardFirstName } from '@/lib/pageHeader';
import type { PersonalView } from '@/lib/pageHeader';
import { fetchMemberProfile } from '@/lib/tour';
import { PersonalHeaderText } from './PersonalHeaderText';
import ui from '@/components/ui.module.css';

/**
 * The header the live app wrote over every view it opened: the steward's own
 * name on his own room (`personalizePageHeader`, index.html:18491).
 *
 * Resolved on the server from the same two cached calls the layout already
 * makes, so this costs no extra round trip. The two surfaces the model returns
 * copy for hand off to a client component that lays the model's version over
 * this one; the rest render here and are done.
 */
export async function PersonalHeader({
  view,
  eyebrow,
}: {
  view: PersonalView;
  /** The small line above the title. The port's own chrome; legacy had none. */
  eyebrow: string;
}) {
  const email = await getAuthedEmail();
  const [profile, onboarding] = await Promise.all([
    email ? fetchMemberProfile(email) : null,
    email ? fetchOnboardingState(email).catch(() => null) : null,
  ]);

  // `parseMemberProfile` uses the literal string 'Steward' for a row with no
  // name, which is also legacy's final fallback, so treating it as "no name"
  // here lets the email local part have its turn first exactly as it did on
  // the live app.
  const name = profile && profile.name !== 'Steward' ? profile.name : null;
  const rawArchetype = profile?.archetype
    ? profile.archetypeName
    : (onboarding?.archetype_name ?? onboarding?.archetype ?? null);

  const header = pageHeader(view, stewardFirstName(name, email), archetypeLabel(rawArchetype));

  if (isAiHeaderView(view)) {
    return (
      <PersonalHeaderText view={view} eyebrow={eyebrow} title={header.title} sub={header.sub} />
    );
  }

  return (
    <header className={ui.header}>
      <p className={ui.eyebrow}>{eyebrow}</p>
      <h1 className={ui.title}>{header.title}</h1>
      <p className={ui.sub}>{header.sub}</p>
    </header>
  );
}
