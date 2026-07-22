import { getAuthedEmail } from '@/lib/auth/session';
import { fetchOnboardingState } from '@/lib/onboarding';
import { RequestAccess } from './RequestAccess';
import styles from '../sign-in/sign-in.module.css';

const DEFAULT_SKOOL = 'https://www.skool.com/bakndcreator';

export default async function JoinPage() {
  const email = await getAuthedEmail();
  let skoolUrl = DEFAULT_SKOOL;
  if (email) {
    try {
      const state = await fetchOnboardingState(email);
      if (state.skool_url) skoolUrl = state.skool_url;
    } catch {
      // fall back to the default community link
    }
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>WHEALTHY / STEWARDS</p>
        <h1 className={styles.heading}>This one&rsquo;s for the Stewards.</h1>
        <p className={styles.help}>
          The Rhythm is for members of the Stewards community. Join the community to get access.
        </p>
        <a href={skoolUrl} className={styles.button} target="_blank" rel="noopener noreferrer">
          Join the Stewards
        </a>
        <RequestAccess defaultEmail={email ?? ''} />
      </div>
    </main>
  );
}
