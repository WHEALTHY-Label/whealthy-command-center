'use client';

import { useEffect, useState } from 'react';
import { searchSkoolMembers, type SkoolMatch } from '@/lib/skool';
import styles from './sign-in.module.css';

/**
 * The "locate" step: find yourself in the Stewards community by name, then
 * continue to sign in. Matches the live app's pre-sign-in screen. Finding a
 * profile is a convenience; a private profile can be missing here and still
 * be a real member, so nothing here blocks access.
 */
export function SkoolLocate({
  onContinue,
  onJoin,
}: {
  onContinue: () => void;
  onJoin: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SkoolMatch[]>([]);
  const [picked, setPicked] = useState<SkoolMatch | null>(null);
  const [searching, setSearching] = useState(false);

  const q = query.trim();
  const active = !picked && q.length >= 2;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchSkoolMembers(q, controller.signal)
        .then((matches) => setResults(matches))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q, active]);

  // Results are only meaningful while a search is active; derive rather than
  // clearing state synchronously in the effect.
  const visibleResults = active ? results : [];

  if (picked) {
    return (
      <div className={styles.form}>
        <p className={styles.eyebrow}>WHEALTHY / STEWARDS</p>
        <h1 className={styles.heading}>Found you.</h1>
        <div className={styles.picked}>
          {picked.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picked.avatar_url} alt="" className={styles.avatar} width={40} height={40} />
          ) : null}
          <span>{picked.name}</span>
        </div>
        <p className={styles.help}>Continue to sign in with the email tied to your membership.</p>
        <button type="button" className={styles.button} onClick={onContinue}>
          That&rsquo;s me, continue
        </button>
        <button type="button" className={styles.linkButton} onClick={() => setPicked(null)}>
          Not you? Search again
        </button>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <p className={styles.eyebrow}>WHEALTHY / STEWARDS</p>
      <h1 className={styles.heading}>Let&rsquo;s find you.</h1>
      <label className={styles.label} htmlFor="skool-q">
        Your name in the Stewards community
      </label>
      <input
        id="skool-q"
        type="text"
        autoComplete="off"
        className={styles.input}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Start typing your name"
      />

      {visibleResults.length > 0 ? (
        <ul className={styles.results}>
          {visibleResults.map((m) => (
            <li key={m.handle}>
              <button type="button" className={styles.result} onClick={() => setPicked(m)}>
                {m.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar_url} alt="" className={styles.avatar} width={32} height={32} />
                ) : (
                  <span className={styles.avatarBlank} aria-hidden="true" />
                )}
                <span className={styles.resultName}>{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : active && !searching ? (
        <p className={styles.help}>
          No match yet. Some members keep their profile private, that&rsquo;s okay.
        </p>
      ) : null}

      <button type="button" className={styles.button} onClick={onContinue}>
        I&rsquo;m already a steward
      </button>
      <button type="button" className={styles.linkButton} onClick={onJoin}>
        New here? The Rhythm is for community members. Join the Stewards
      </button>
    </div>
  );
}
