import Link from 'next/link';

export default function NotFound() {
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
      <h1 style={{ fontSize: 'var(--wa-fs-h1)' }}>Page not found</h1>
      <p style={{ color: 'var(--wa-text-muted)', margin: 0 }}>
        That page doesn&rsquo;t exist in the migration preview.
      </p>
      <Link href="/">Return home</Link>
    </main>
  );
}
