'use client';

import { useActionState } from 'react';
import { requestAccess, type RequestResult } from './actions';
import styles from '../sign-in/sign-in.module.css';

const INITIAL: RequestResult = { ok: false };

export function RequestAccess({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState(requestAccess, INITIAL);

  if (state.ok && (state.pending || state.alreadyMember)) {
    return (
      <p className={styles.help}>
        {state.alreadyMember
          ? 'Good news — you are already a member. Try signing in.'
          : (state.message ??
            'Your request is in. We review new stewards within 24 hours, and you will get access once approved.')}
      </p>
    );
  }

  return (
    <form action={action} className={styles.form}>
      <label className={styles.label} htmlFor="req-email">
        Already joined? Request your access
      </label>
      <input
        id="req-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        defaultValue={defaultEmail}
        className={styles.input}
        placeholder="you@example.com"
      />
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      <button type="submit" className={styles.button} disabled={pending}>
        {pending ? 'Sending…' : 'Request access'}
      </button>
    </form>
  );
}
