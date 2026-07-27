import Link from 'next/link';
import { getAuthedEmail } from '@/lib/auth/session';
import { fetchOnboardingState } from '@/lib/onboarding';
import {
  bundleState,
  fetchGovernorState,
  fetchRhythmStatus,
  fetchWallCommunity,
  firstStepsProgress,
  selectDirective,
  wallGarnish,
} from '@/lib/dashboard';
import { fetchMemberProfile } from '@/lib/tour';
import { RetakeTourLink } from '@/components/tour/RetakeTourLink';
import styles from './page.module.css';

export default async function DashboardPage() {
  const email = await getAuthedEmail();
  // The layout guarantees an authenticated member; satisfy the type.
  if (!email) return null;

  const [onboarding, rhythm, governor, profile, wall] = await Promise.all([
    fetchOnboardingState(email),
    fetchRhythmStatus(email),
    fetchGovernorState(email),
    fetchMemberProfile(email),
    fetchWallCommunity(email),
  ]);

  const archetype = onboarding.archetype_name ?? onboarding.archetype ?? 'Steward';
  const directive = selectDirective({ fast: governor.fast, aiDirective: governor.aiDirective });
  const bundle = bundleState(onboarding);
  // The real flags live in approved_members.first_steps and come back from
  // verify-member. A claimed bundle also counts, because a member can buy
  // through a link that never routes them through /claim.
  const steps = firstStepsProgress({
    ...profile.firstSteps,
    ...(bundle.claimed ? { bundle: true } : {}),
  });

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.directiveCard}`}>
        <p className={styles.eyebrow}>Command Center</p>
        <h1 className={styles.name}>{archetype}</h1>
        <p className={styles.directiveLabel}>Daily Directive</p>
        <p className={styles.directive}>{directive}</p>
      </section>

      <section className={`${styles.card} ${styles.bundleCard}`}>
        <div>
          <p className={styles.cardKicker}>Your Bundle</p>
          <p className={styles.bundleName}>{bundle.name ?? 'Your personalized plan'}</p>
        </div>
        <Link href="/claim" className={styles.cta}>
          {bundle.claimed ? 'Start your governed day' : 'See your personalized plan'}
        </Link>
      </section>

      <section className={styles.card}>
        <div className={styles.stepsHead}>
          <p className={styles.cardKicker}>First Steps</p>
          <span className={styles.stepsCount}>
            {archetype}, {steps.done} of {steps.total}
          </span>
        </div>
        <div className={styles.bar} aria-hidden="true">
          <div
            className={styles.barFill}
            style={{ width: `${(steps.done / steps.total) * 100}%` }}
          />
        </div>
        <ul className={styles.steps}>
          {steps.steps.map((s) => (
            <li key={s.key} className={styles.step}>
              <span
                className={`${styles.dot} ${s.done ? styles.dotDone : ''}`}
                aria-hidden="true"
              />
              <Link href={s.href} className={s.done ? styles.stepDone : styles.stepLink}>
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className={styles.stepsFooter}>
          Walk the house once. Each step checks itself off as you live it.{' '}
          <RetakeTourLink />
        </p>
      </section>

      <section className={styles.card}>
        <p className={styles.cardKicker}>Today&rsquo;s disciplines</p>
        {rhythm.slots.length > 0 ? (
          <ul className={styles.disciplines}>
            {rhythm.slots.map((slot, i) => (
              <li key={slot.id ?? i} className={styles.discipline}>
                <div className={styles.disciplineHead}>
                  <span className={styles.disciplineTitle}>{slot.title}</span>
                  {slot.timeWindow ? (
                    <span className={styles.disciplineTime}>{slot.timeWindow}</span>
                  ) : null}
                </div>
                {slot.ifThen ? <p className={styles.disciplineIfThen}>{slot.ifThen}</p> : null}
                {slot.why ? <p className={styles.disciplineWhy}>{slot.why}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>
            No rhythm yet. Your assessment builds it with you, one anchor at a time.
          </p>
        )}
      </section>

      {/* The live app hid this card whenever the wall was empty. It shows
          either way now, because an empty wall is exactly when a steward
          should be invited to bring something to it. */}
      <section className={`${styles.card} ${styles.wallCard}`}>
        <p className={styles.cardKicker}>The Wall</p>
        <p className={styles.wallGarnish}>{wallGarnish(wall)}</p>
        <Link href="/wall" className={styles.cta}>
          {wall.livePosts > 0 ? 'Go to the Wall' : 'Bring yours here'}
        </Link>
      </section>

      <section className={`${styles.card} ${styles.fellowship}`}>
        <p className={styles.cardKicker}>Steward Fellowship</p>
        <p className={styles.fellowshipBody}>
          You carry this with others. The community is walking the same rhythm.
        </p>
        <Link href="/community" className={styles.cta}>
          Open Community
        </Link>
      </section>
    </div>
  );
}
