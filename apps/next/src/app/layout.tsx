import type { Metadata, Viewport } from 'next';
import { dmSans, oswald } from '@/lib/fonts';
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
    // Oswald for display and DM Sans for body, the same pairing production
    // uses, now served from this origin. `src/lib/fonts.ts` explains why they
    // arrive as variables rather than family names.
    <html lang="en" className={`${oswald.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
