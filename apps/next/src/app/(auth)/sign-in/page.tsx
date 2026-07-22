'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendCode, verifyCode, type ActionResult } from './actions';
import { SkoolLocate } from './SkoolLocate';
import styles from './sign-in.module.css';

const INITIAL: ActionResult = { ok: false };

type Step = 'locate' | 'email' | 'code';

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('locate');
  const [email, setEmail] = useState('');
  const [sendState, sendAction, sending] = useActionState(sendCode, INITIAL);
  const [verifyState, verifyAction, verifying] = useActionState(verifyCode, INITIAL);

  // Advance to the code step once a code has been sent.
  const showCode = step === 'email' && sendState.ok;

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        {step === 'locate' ? (
          <SkoolLocate onContinue={() => setStep('email')} onJoin={() => router.push('/join')} />
        ) : !showCode ? (
          <form action={sendAction} className={styles.form}>
            <p className={styles.eyebrow}>WHEALTHY / STEWARDS</p>
            <h1 className={styles.heading}>Sign in</h1>
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
            <button type="button" className={styles.linkButton} onClick={() => setStep('locate')}>
              Back
            </button>
          </form>
        ) : (
          <form action={verifyAction} className={styles.form}>
            <p className={styles.eyebrow}>WHEALTHY / STEWARDS</p>
            <h1 className={styles.heading}>Enter your code</h1>
            <input type="hidden" name="email" value={email} />
            <label className={styles.label} htmlFor="token">
              6-digit code
            </label>
            <input
              id="token"
              name="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              className={styles.input}
              placeholder="000000"
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
