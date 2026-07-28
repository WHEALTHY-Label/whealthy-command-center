const EXPECTED_TITLE = "WHEALTHY — The Steward's Rhythm";
const PROJECT_REF = 'yzaxzmuuvozonhgwhlim';
const REQUIRED_APP_MARKERS = ['id="navDash"', 'id="dashView"', 'id="rhythmView"'];
const REQUIRED_HASHES = ['dash', 'rhythm'];

export function validateFinalProductionUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`Final URL must use HTTPS: ${url.protocol}`);
  if (!['thestewardsrhythm.com', 'www.thestewardsrhythm.com'].includes(url.hostname)) {
    throw new Error(`Unexpected final hostname: ${url.hostname}`);
  }
  return url;
}

export function validateLiveHtml(html) {
  if (!/^<!doctype html>/i.test(html.trimStart())) throw new Error('Missing HTML doctype');
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  if (title !== EXPECTED_TITLE) throw new Error(`Unexpected title: ${title ?? 'missing'}`);
  if (!html.includes(PROJECT_REF)) throw new Error('Supabase project reference missing');
  const missingMarker = REQUIRED_APP_MARKERS.find((marker) => !html.includes(marker));
  if (missingMarker) throw new Error(`Missing WHEALTHY app marker: ${missingMarker}`);
  const { hashes } = extractRouteInventory(html);
  const missingHash = REQUIRED_HASHES.find((hash) => !hashes.includes(hash));
  if (missingHash) throw new Error(`Missing required WHEALTHY route behavior: ${missingHash}`);
  const byteLength = Buffer.byteLength(html);
  if (byteLength < 500_000) throw new Error(`Capture is unexpectedly small: ${byteLength}`);
  return { title, lineCount: html.split('\n').length, byteLength };
}

export function extractRouteInventory(html) {
  const hashes = new Set();
  for (const match of html.matchAll(/\bgo\(\s*['"]([^'"]+)['"]\s*\)/g)) hashes.add(match[1]);
  for (const match of html.matchAll(/href=["']#([^"']+)["']/g)) hashes.add(match[1]);
  const entryPoints = [...new Set([...html.matchAll(/href=["'](whealthy-[^"'#?]+\.html)/g)].map((match) => match[1]))].sort();
  return { hashes: [...hashes].sort(), entryPoints };
}
