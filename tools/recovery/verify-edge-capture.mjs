import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { sha256, writeJson } from './lib/manifest.mjs';

async function filesUnder(root, current = root) {
  const output = [];
  for (const name of (await readdir(current)).sort()) {
    const path = join(current, name);
    if ((await stat(path)).isDirectory()) output.push(...await filesUnder(root, path));
    else output.push(path);
  }
  return output;
}

const manifestPath = 'docs/recovery/2026-07-21/edge-functions.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const expectedRedactedSlugs = [
  'add-member',
  'cancel-nurture-sequence',
  'crm-health',
  'member-onboarding-check',
  'send-nurture-email',
  'skool-sync',
  'trigger-nurture-sequence',
];
for (const fn of manifest.functions) {
  if (fn.status === 'local_only') continue;
  const root = join('.recovery-tmp/functions', fn.slug);
  const paths = await filesUnder(root);
  if (paths.length === 0) throw new Error(`No files captured for ${fn.slug}`);
  fn.localFiles = [];
  for (const path of paths) {
    const content = await readFile(path);
    fn.localFiles.push({
      path: relative(root, path),
      sha256: sha256(content),
      bytes: content.length,
    });
  }
  if (fn.status === 'redacted') {
    if (typeof fn.redactionReason !== 'string' || fn.redactionReason.length === 0) {
      throw new Error(`Missing redaction reason for ${fn.slug}`);
    }
    const capturedSource = (await Promise.all(paths.map((path) => readFile(path, 'utf8')))).join('\n');
    if (
      !/Deno\.env\.get\((?:['"])NURTURE_WEBHOOK_SECRET/.test(capturedSource)
      || !/(?:not configured|not_configured)/.test(capturedSource)
    ) {
      throw new Error(`Redacted function ${fn.slug} does not fail closed for its credential`);
    }
    continue;
  }
  fn.status = 'captured';
}
await writeJson(manifestPath, manifest);
const captured = manifest.functions.filter((fn) => fn.status === 'captured').length;
const redacted = manifest.functions.filter((fn) => fn.status === 'redacted').length;
const actualRedactedSlugs = manifest.functions
  .filter((fn) => fn.status === 'redacted')
  .map((fn) => fn.slug)
  .sort();
if (JSON.stringify(actualRedactedSlugs) !== JSON.stringify(expectedRedactedSlugs)) {
  throw new Error(`Unexpected redacted function set: ${actualRedactedSlugs.join(', ')}`);
}
if (captured !== 74 || redacted !== 7) {
  throw new Error(`Expected 74 exact captures and 7 redactions, got ${captured} and ${redacted}`);
}
console.log(`Verified ${captured} exact captures and ${redacted} approved redactions`);
