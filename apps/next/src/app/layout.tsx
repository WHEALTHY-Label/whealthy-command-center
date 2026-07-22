import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: "WHEALTHY — The Steward's Rhythm",
  description: 'Next.js migration preview environment. Not the live site.',
  // Preview must never be indexed while the static site is canonical.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#080809',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/*
          Fonts loaded exactly as the recovered production app does (Oswald
          display + DM Sans body). Kept as a stylesheet link rather than
          next/font so the build has no dependency on fetching Google Fonts.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          next/font is the idiomatic choice but fetches from Google Fonts at
          build time, which the migration build environment blocks. This
          stylesheet link matches production exactly and needs no build-time
          fetch. Follow-up: self-host the woff2 files via next/font/local to
          drop the runtime Google dependency and this suppression.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
