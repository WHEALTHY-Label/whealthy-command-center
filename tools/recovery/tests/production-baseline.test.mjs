import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../lib/manifest.mjs';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const repoPath = (path) => resolve(repoRoot, path);

const readJson = async (path) => JSON.parse(await readFile(repoPath(path), 'utf8'));
const readText = (path) => readFile(repoPath(path), 'utf8');

const inputPaths = [
  'index.html',
  'docs/recovery/2026-07-21/route-inventory.json',
  'docs/recovery/2026-07-21/edge-functions.json',
  'docs/recovery/2026-07-21/migrations.json',
  'docs/recovery/2026-07-21/security-advisors.json',
  'docs/recovery/2026-07-21/smoke-results.json',
  'supabase/baseline/2026-07-21-public-schema.sql',
  'docs/recovery/2026-07-21/add-member-credential-redaction.md',
  'docs/recovery/2026-07-21/database-recovery-limitations.md',
];

test('manifest points at the exact recovered production baseline', async () => {
  const manifest = await readJson('docs/recovery/2026-07-21/production-manifest.json');
  const html = await readText('index.html');

  assert.equal(manifest.html.source, 'https://thestewardsrhythm.com/');
  assert.equal(manifest.html.sha256, sha256(html));
  assert.equal(manifest.html.bytes, Buffer.byteLength(html));
  assert.equal(manifest.html.routes.sha256, manifest.html.sha256);
  assert.equal(manifest.git.branch, 'recovery/production-baseline-2026-07-21');
  assert.equal(manifest.supabase.projectId, 'yzaxzmuuvozonhgwhlim');
  assert.equal(manifest.vercel.projectId, 'prj_0Ju0B5KYjA8z9vrlghwTp2MhLUw2');
  assert.equal(manifest.vercel.teamId, 'team_ePajvo1uCVVsbvJHZsXPrepW');
  assert.equal(manifest.vercel.deploymentId, 'dpl_AEjt6dY2YzmSWrxSnTofERBH7SWm');
  assert.equal(manifest.vercel.deploymentState, 'READY');
  assert.equal(manifest.vercel.target, 'production');
  assert.equal(manifest.vercel.sourceRepository, 'WHEALTHY-Label/whealthy-command-center');
  assert.equal(manifest.vercel.sourceBranch, 'main');
  assert.equal(manifest.vercel.sourceCommit, 'bc66f8fa3ca814a5ec9ada254072a092519bbce6');
  assert.deepEqual(manifest.vercel.customDomains, ['thestewardsrhythm.com', 'www.thestewardsrhythm.com']);
  assert.equal(manifest.vercel.domainMappingVerified, true);
});

test('manifest hashes every baseline input and records exact recovery counts', async () => {
  const manifest = await readJson('docs/recovery/2026-07-21/production-manifest.json');
  const inputs = Object.fromEntries(manifest.integrity.inputs.map((input) => [input.path, input]));

  assert.deepEqual(Object.keys(inputs).sort(), [...inputPaths].sort());
  for (const path of inputPaths) {
    const text = await readText(path);
    assert.equal(inputs[path].sha256, sha256(text), `${path} digest must match`);
    assert.equal(inputs[path].bytes, Buffer.byteLength(text), `${path} byte count must match`);
  }

  assert.deepEqual(manifest.integrity.counts, {
    functionRecords: 81,
    capturedFunctions: 74,
    redactedFunctions: 7,
    migrationRecords: 46,
    missingMigrationSources: 46,
    smokeTests: 3,
    passedSmokeTests: 3,
  });
  assert.equal(manifest.supabase.functions.functions.length, 81);
  assert.equal(manifest.supabase.functions.functions.filter((fn) => fn.status === 'captured').length, 74);
  assert.deepEqual(manifest.supabase.functions.functions.filter((fn) => fn.status === 'redacted').map((fn) => fn.slug), [
    'add-member',
    'cancel-nurture-sequence',
    'crm-health',
    'member-onboarding-check',
    'send-nurture-email',
    'skool-sync',
    'trigger-nurture-sequence',
  ]);
  for (const fn of manifest.supabase.functions.functions) {
    for (const file of fn.localFiles) {
      const content = await readFile(repoPath(`supabase/functions/${fn.slug}/${file.path}`));
      assert.equal(file.sha256, sha256(content), `${fn.slug}/${file.path} digest must match`);
      assert.equal(file.bytes, content.length, `${fn.slug}/${file.path} byte count must match`);
    }
  }
  assert.equal(manifest.supabase.migrations.migrations.length, 46);
  assert.equal(manifest.supabase.migrations.migrations.filter((migration) => migration.status === 'missing').length, 46);
  assert.equal(manifest.supabase.schemaSnapshot.replayable, false);
  assert.equal(manifest.supabase.schemaSnapshot.path, 'supabase/baseline/2026-07-21-public-schema.sql');
});

test('manifest records clean security verification, smoke coverage, and a name-only configuration inventory', async () => {
  const manifest = await readJson('docs/recovery/2026-07-21/production-manifest.json');

  assert.equal(manifest.supabase.securityAdvisorErrors, 0);
  assert.equal(manifest.verification.secretScan, 'passed');
  assert.equal(manifest.verification.historySecretScan, 'passed');
  assert.equal(manifest.verification.edgeRecursiveDiff, 'passed');
  assert.equal(manifest.verification.smokeSuite, 'passed');
  assert.equal(manifest.smoke.tests.length, 3);
  assert.equal(manifest.smoke.tests.filter((result) => result.status === 'passed').length, 3);
  assert.equal(manifest.configuration.environmentVariableNames.length, 18);
  for (const name of manifest.configuration.environmentVariableNames) {
    assert.match(name, /^[A-Z][A-Z0-9_]*$/);
  }
  assert.equal(Object.hasOwn(manifest.configuration, 'environmentVariableValues'), false);
  assert.doesNotMatch(JSON.stringify(manifest.configuration), /(?:https?:\/\/[^\s"']{24,}|(?:sk|rk|sb|eyJ)[A-Za-z0-9._-]{20,})/i);
});
