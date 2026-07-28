export const production = 'https://thestewardsrhythm.com/';

const productionOrigins = new Set(['https://thestewardsrhythm.com', 'https://www.thestewardsrhythm.com']);
const observedGoogleFontFamilies = new Set([
  'Oswald:wght@500;600;700',
  'DM Sans:wght@400;500;600;700',
]);
const contentImagePrefix = '/s/07333876398906327/thumbnails/640x480/LEMON/';
const credentialLikeParameter = /token|secret|key|credential|authorization|bearer|password|session|auth/i;

export function safeRequestOrigin(value) {
  const url = new URL(value);
  return url.origin;
}

export function isAllowedPublicRequest(method, value) {
  if (method !== 'GET' && method !== 'HEAD') return false;

  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) return false;

  if (productionOrigins.has(url.origin)) {
    return !url.search && (url.pathname === '/'
      || url.pathname === '/favicon.ico'
      || url.pathname.startsWith('/assets/')
      || url.pathname.startsWith('/static/')
      || url.pathname.startsWith('/_next/static/'));
  }

  if (url.origin === 'https://cdn.jsdelivr.net') {
    return !url.search && url.pathname === '/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  }

  if (url.origin === 'https://content.app-sources.com') {
    return isAllowedContentImagePath(url.pathname) && isAllowedContentImageQuery(url.searchParams);
  }

  if (url.origin === 'https://fonts.googleapis.com') {
    return url.pathname === '/css2' && isAllowedGoogleFontsQuery(url.searchParams);
  }

  if (url.origin === 'https://fonts.gstatic.com') {
    return !url.search && (url.pathname.startsWith('/s/dmsans/') || url.pathname.startsWith('/s/oswald/'));
  }

  return false;
}

export function isAllowedFinalProductionUrl(value) {
  const url = new URL(value);
  return productionOrigins.has(url.origin)
    && !url.username
    && !url.password
    && !url.search
    && !url.hash
    && url.pathname === '/';
}

function isAllowedGoogleFontsQuery(searchParams) {
  const familyValues = searchParams.getAll('family');
  const displayValues = searchParams.getAll('display');

  if (familyValues.length === 0 || displayValues.length > 1) return false;

  for (const [key, value] of searchParams) {
    if (credentialLikeParameter.test(key) || credentialLikeParameter.test(value)) return false;
    if (key !== 'family' && key !== 'display') return false;
  }

  return familyValues.every((value) => observedGoogleFontFamilies.has(value))
    && new Set(familyValues).size === familyValues.length
    && displayValues.every((value) => value === 'swap');
}

function isAllowedContentImagePath(pathname) {
  if (!pathname.startsWith(contentImagePrefix)) return false;

  const encodedFileName = pathname.slice(contentImagePrefix.length);
  let fileName;
  try {
    fileName = decodeURIComponent(encodedFileName);
  } catch {
    return false;
  }

  return !fileName.includes('/')
    && !fileName.includes('..')
    && !fileName.includes('%')
    && /\.(?:jpe?g|png|webp)$/i.test(fileName);
}

function isAllowedContentImageQuery(searchParams) {
  const entries = [...searchParams];
  return entries.length === 1 && entries[0][0] === 'format' && entries[0][1] === 'webp';
}
