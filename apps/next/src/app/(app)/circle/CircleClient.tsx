'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CircleDay } from '@/lib/circles';
import { createCircle, joinCircle, leaveCircle, nudgeMember } from './actions';
import ui from '@/components/ui.module.css';
import styles from './circle.module.css';

export function CircleClient({ circle }: { circle: CircleDay | null }) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? 'That did not save.');
        return;
      }
      if (result.message) setNote(result.message);
      router.refresh();
    });
  };

  if (!circle) {
    return (
      <>
        <section className={ui.card}>
          <p className={ui.kicker}>Join a circle</p>
          <p className={ui.body}>Enter a 6-character invite code shared by another Steward.</p>
          <div className={ui.row}>
            <input
              className={`${ui.input} ${styles.codeInput}`}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABC234"
              autoComplete="off"
            />
            <button
              type="button"
              className={ui.primary}
              disabled={pending || joinCode.length !== 6}
              onClick={() => run(() => joinCircle(joinCode))}
            >
              Join circle
            </button>
          </div>
        </section>

        <section className={ui.card}>
          <p className={ui.kicker}>Create a circle</p>
          <p className={ui.body}>
            Start a new Steward Circle and invite up to 6 accountability partners.
          </p>
          <div className={ui.row}>
            <input
              className={ui.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Circle name"
            />
            <button
              type="button"
              className={ui.primary}
              disabled={pending || !name.trim()}
              onClick={() => run(() => createCircle(name))}
            >
              Create circle
            </button>
          </div>
        </section>
        {error ? <p className={ui.error}>{error}</p> : null}
      </>
    );
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(circle.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The code is on screen either way.
    }
  };

  return (
    <>
      <section className={ui.cardLime}>
        <p className={ui.kicker}>{circle.name}</p>
        <div className={ui.row}>
          <span className={styles.inviteCode}>{circle.inviteCode}</span>
          <button type="button" className={ui.quiet} onClick={() => void copyCode()}>
            {copied ? 'Copied!' : 'Copy invite code'}
          </button>
        </div>
        <p className={ui.sub}>Circle members ({circle.members.length}/7)</p>
      </section>

      <section className={ui.card}>
        <ul className={styles.members}>
          {circle.members.map((m) => (
            <li key={m.memberId} className={styles.member}>
              <div className={styles.memberHead}>
                <span className={styles.memberName}>{m.name}</span>
                {m.role === 'shepherd' ? <span className={ui.pillLime}>Shepherd</span> : null}
              </div>
              {/* The four disciplines today. A dashed fast means no active
                  fast, which is not a miss. */}
              <div className={styles.disciplines} aria-label="Disciplines kept today">
                <span className={m.word ? styles.kept : styles.notKept}>W</span>
                <span className={m.prayer ? styles.kept : styles.notKept}>P</span>
                <span
                  className={m.fast === null ? styles.noFast : m.fast ? styles.kept : styles.notKept}
                >
                  {m.fast === null ? '–' : 'F'}
                </span>
                <span className={m.record ? styles.kept : styles.notKept}>R</span>
              </div>
              <button
                type="button"
                className={ui.quiet}
                disabled={pending || m.iPrayedCount >= 3}
                onClick={() => run(() => nudgeMember(circle.circleId, m.memberId))}
              >
                {m.iPrayedCount >= 3 ? '🙏 Prayed today' : '🙏 Pray'}
              </button>
            </li>
          ))}
        </ul>
        {note ? <p className={ui.good}>{note}</p> : null}
        {error ? <p className={ui.error}>{error}</p> : null}
      </section>

      <section className={ui.card}>
        {confirmLeave ? (
          <>
            <p className={ui.body}>
              Are you sure you want to leave this circle? Your accountability partners will see
              that you left, but there is no guilt here.
            </p>
            <div className={ui.row}>
              <button
                type="button"
                className={ui.danger}
                disabled={pending}
                onClick={() => run(() => leaveCircle(circle.circleId))}
              >
                Yes, leave
              </button>
              <button type="button" className={ui.quiet} onClick={() => setConfirmLeave(false)}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button type="button" className={ui.danger} onClick={() => setConfirmLeave(true)}>
            Leave circle
          </button>
        )}
      </section>
    </>
  );
}
