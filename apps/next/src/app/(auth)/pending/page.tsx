import Link from 'next/link';
import { getAuthedEmail } from '@/lib/auth/session';
import { fetchOnboardingState } from '@/lib/onboarding';
import styles from '../sign-in/sign-in.module.css';

const DEFAULT_MESSAGE =
  'Your request is in. We review new stewards within 24 hours, and you will get access once you are approved.';

export default async function PendingPage() {
  const email = await getAuthedEmail();
  let message = DEFAULT_MESSAGE;
  if (email) {
    try {
      const state = await fetchOnboardingState(email);
      if (state.message) message = state.message;
    } catch {
      // fall back to the default copy
    }
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>WHEALTHY / STEWARDS</p>
        <h1 className={styles.heading}>You&rsquo;re on the list.</h1>
        <p className={styles.help}>{message}</p>
        <Link href="/sign-in" className={styles.button}>
          Close
        </Link>
      </div>
    </main>
  );
}
