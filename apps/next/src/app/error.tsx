'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for later observability wiring; no secret payloads.
    console.error('Route error boundary:', error.message);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--wa-space-4)',
        padding: 'var(--wa-space-8) var(--wa-space-4)',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 'var(--wa-fs-h1)' }}>Something went wrong</h1>
      <p style={{ color: 'var(--wa-text-muted)', margin: 0 }}>
        An unexpected error occurred. You can try again.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          fontFamily: 'var(--wa-font-display)',
          background: 'var(--wa-lime)',
          color: 'var(--wa-black)',
          border: 'none',
          borderRadius: 'var(--wa-radius)',
          padding: 'var(--wa-space-3) var(--wa-space-6)',
          fontSize: 'var(--wa-fs-body)',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </main>
  );
}
