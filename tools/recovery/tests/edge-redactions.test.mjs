import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const expectedRedacted = [
  'add-member',
  'cancel-nurture-sequence',
  'crm-health',
  'member-onboarding-check',
  'send-nurture-email',
  'skool-sync',
  'trigger-nurture-sequence',
];

test('edge recovery cannot claim fewer than seven credential redactions', async () => {
  const path = resolve(repoRoot, 'docs/recovery/2026-07-21/edge-functions.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  const redacted = manifest.functions
    .filter((fn) => fn.status === 'redacted')
    .map((fn) => fn.slug)
    .sort();
  assert.equal(manifest.functions.length, 81);
  assert.equal(manifest.functions.filter((fn) => fn.status === 'captured').length, 74);
  assert.deepEqual(redacted, expectedRedacted);
  for (const fn of manifest.functions.filter((item) => item.status === 'redacted')) {
    assert.match(fn.redactionReason, /rotate NURTURE_WEBHOOK_SECRET/i);
  }
});
