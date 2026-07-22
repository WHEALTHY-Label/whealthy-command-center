'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem 1rem',
          textAlign: 'center',
          background: '#080809',
          color: '#f0f1f3',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1>Something went wrong</h1>
        <p style={{ color: '#b5b7bc', margin: 0 }}>The application failed to load.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: '#ccff00',
            color: '#080809',
            border: 'none',
            borderRadius: '12px',
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
