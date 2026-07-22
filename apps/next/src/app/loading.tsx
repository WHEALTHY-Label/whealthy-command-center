export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '50dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--wa-text-dim)',
        fontSize: 'var(--wa-fs-small)',
      }}
    >
      Loading…
    </div>
  );
}
