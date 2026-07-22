'use client';

import { useActionState, useState } from 'react';
import { sendCode, verifyCode, type ActionResult } from './actions';
import styles from './sign-in.module.css';

const INITIAL: ActionResult = { ok: false };

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [sendState, sendAction, sending] = useActionState(sendCode, INITIAL);
  const [verifyState, verifyAction, verifying] = useActionState(verifyCode, INITIAL);

  const codeSent = sendState.ok;

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>WHEALTHY / STEWARDS</p>
        <h1 className={styles.heading}>Sign in</h1>

        {!codeSent ? (
          <form action={sendAction} className={styles.form}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="you@example.com"
            />
            <p className={styles.help}>
              Use the email tied to your Stewards community membership. We&rsquo;ll send a one-time
              code.
            </p>
            {sendState.error ? <p className={styles.error}>{sendState.error}</p> : null}
            <button type="submit" className={styles.button} disabled={sending}>
              {sending ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form action={verifyAction} className={styles.form}>
            <input type="hidden" name="email" value={email} />
            <label className={styles.label} htmlFor="token">
              Enter the code
            </label>
            <input
              id="token"
              name="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              className={styles.input}
              placeholder="6-digit code"
            />
            <p className={styles.help}>We sent a code to {email}. It expires shortly.</p>
            {verifyState.error ? <p className={styles.error}>{verifyState.error}</p> : null}
            <button type="submit" className={styles.button} disabled={verifying}>
              {verifying ? 'Verifying…' : 'Verify and continue'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
