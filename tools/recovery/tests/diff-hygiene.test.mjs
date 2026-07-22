import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assessDiffHygiene } from '../verify-diff-hygiene.mjs';
import { sha256 } from '../lib/manifest.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'whealthy-diff-hygiene-'));
  const html = '<html>exact production bytes  </html>\n';
  const captured = 'export const captured = true;  \n';
  const redacted = "const secret = Deno.env.get('NURTURE_WEBHOOK_SECRET');  \n";
  await mkdir(join(root, 'docs/recovery/2026-07-21'), { recursive: true });
  await mkdir(join(root, 'supabase/functions/exact'), { recursive: true });
  await mkdir(join(root, 'supabase/functions/redacted'), { recursive: true });
  await writeFile(join(root, 'index.html'), html);
  await writeFile(join(root, 'supabase/functions/exact/index.ts'), captured);
  await writeFile(join(root, 'supabase/functions/redacted/index.ts'), redacted);
  await writeFile(join(root, 'docs/recovery/2026-07-21/route-inventory.json'), JSON.stringify({ sha256: sha256(html) }));
  await writeFile(join(root, 'docs/recovery/2026-07-21/edge-functions.json'), JSON.stringify({
    functions: [
      { slug: 'exact', status: 'captured', localFiles: [{ path: 'index.ts', sha256: sha256(captured) }] },
      { slug: 'redacted', status: 'redacted', localFiles: [{ path: 'index.ts', sha256: sha256(redacted) }] },
    ],
  }));
  return root;
}

test('allows whitespace findings only for hash-verified production HTML and exact captures', async () => {
  const root = await fixture();
  const result = await assessDiffHygiene({
    root,
    output: [
      'index.html:1: trailing whitespace.',
      '+<html>exact production bytes  </html>',
      'supabase/functions/exact/index.ts:1: trailing whitespace.',
      '+export const captured = true;  ',
    ].join('\n'),
  });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.allowedFindings, 2);
});

test('rejects findings in redacted, generated, tool, and documentation files', async () => {
  const root = await fixture();
  for (const path of [
    'supabase/functions/redacted/index.ts',
    'docs/recovery/2026-07-21/production-manifest.json',
    'tools/recovery/build-manifest.mjs',
    'docs/recovery/2026-07-21/README.md',
  ]) {
    const result = await assessDiffHygiene({ root, output: `${path}:1: trailing whitespace.\n+bad  ` });
    assert.equal(result.ok, false, `${path} must be rejected`);
    assert.match(result.errors.join('\n'), /not an allowed byte-faithful capture/);
  }
});

test('rejects an allowlisted path when its current bytes do not match its manifest hash', async () => {
  const root = await fixture();
  await writeFile(join(root, 'index.html'), '<html>changed  </html>\n');
  const result = await assessDiffHygiene({ root, output: 'index.html:1: trailing whitespace.\n+<html>changed  </html>' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /hash does not match/);
});

test('rejects unparsed git diff --check output', async () => {
  const root = await fixture();
  const result = await assessDiffHygiene({ root, output: 'unexpected git diagnostic' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Unrecognized/);
});

test('rejects non-whitespace diagnostics even in an exact capture', async () => {
  const root = await fixture();
  const result = await assessDiffHygiene({ root, output: 'index.html:1: leftover conflict marker' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /not an allowed whitespace finding/);
});
