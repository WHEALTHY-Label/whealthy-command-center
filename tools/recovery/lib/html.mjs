const EXPECTED_TITLE = "WHEALTHY — The Steward's Rhythm";
const PROJECT_REF = 'yzaxzmuuvozonhgwhlim';

export function validateLiveHtml(html) {
  if (!/^<!doctype html>/i.test(html.trimStart())) throw new Error('Missing HTML doctype');
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  if (title !== EXPECTED_TITLE) throw new Error(`Unexpected title: ${title ?? 'missing'}`);
  if (!html.includes(PROJECT_REF)) throw new Error('Supabase project reference missing');
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
