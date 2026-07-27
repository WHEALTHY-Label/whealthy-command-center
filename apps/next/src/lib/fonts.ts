import localFont from 'next/font/local';

/**
 * The two production faces, self-hosted.
 *
 * The recovered app pulled these from Google Fonts with a stylesheet link,
 * which cost every visitor two extra connections before a single word could
 * paint and left the type dependent on a third party staying up. The latin
 * woff2 files (the only subset the app has ever used) are checked in under
 * `src/fonts`, so nothing is fetched at build time or at runtime.
 *
 * Both are exposed as CSS variables rather than family names because
 * `next/font` hashes the family it generates. `src/styles/tokens.css` reads
 * these variables through `--wa-font-display` and `--wa-font-body`, so no
 * component had to change.
 *
 * `display: 'swap'` keeps the fallback visible while the face loads, matching
 * the `&display=swap` the stylesheet link used to carry: text is readable
 * immediately on a slow connection instead of holding a blank page.
 */
export const oswald = localFont({
  src: [
    { path: '../fonts/oswald-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/oswald-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/oswald-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-oswald',
  display: 'swap',
  // Named so the browser can size the fallback closely and the headings do not
  // jump when the real face arrives.
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

export const dmSans = localFont({
  src: [
    { path: '../fonts/dm-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/dm-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/dm-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/dm-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-dm-sans',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});
