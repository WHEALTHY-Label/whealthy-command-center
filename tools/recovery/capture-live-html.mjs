import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { extractRouteInventory, validateFinalProductionUrl, validateLiveHtml } from './lib/html.mjs';
import { sha256, writeJson } from './lib/manifest.mjs';

const outputFlag = process.argv.indexOf('--output');
if (outputFlag < 0 || !process.argv[outputFlag + 1]) throw new Error('Usage: --output <path>');

const target = resolve(process.argv[outputFlag + 1]);
const response = await fetch('https://thestewardsrhythm.com/', { redirect: 'follow' });
if (!response.ok) throw new Error(`Production returned HTTP ${response.status}`);
validateFinalProductionUrl(response.url);
const html = await response.text();
const validation = validateLiveHtml(html);
await mkdir(dirname(target), { recursive: true });
await writeFile(target, html, 'utf8');
await writeJson('docs/recovery/2026-07-21/route-inventory.json', {
  capturedAt: new Date().toISOString(),
  source: 'https://thestewardsrhythm.com/',
  sha256: sha256(html),
  ...validation,
  ...extractRouteInventory(html),
});
console.log(JSON.stringify({ target, sha256: sha256(html), ...validation }));
