import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256, writeJson } from './lib/manifest.mjs';

const recoveryRoot = 'docs/recovery/2026-07-21';
const inputPaths = [
  'index.html',
  `${recoveryRoot}/route-inventory.json`,
  `${recoveryRoot}/edge-functions.json`,
  `${recoveryRoot}/migrations.json`,
  `${recoveryRoot}/security-advisors.json`,
  `${recoveryRoot}/smoke-results.json`,
  'supabase/baseline/2026-07-21-public-schema.sql',
  `${recoveryRoot}/add-member-credential-redaction.md`,
  `${recoveryRoot}/database-recovery-limitations.md`,
];

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

async function sourceFiles(root) {
  const files = [];
  for (const name of (await readdir(root)).sort()) {
    const path = join(root, name);
    if ((await stat(path)).isDirectory()) files.push(...await sourceFiles(path));
    else if (path.endsWith('.ts')) files.push(path);
  }
  return files;
}

async function environmentVariableNames() {
  const names = new Set();
  const pattern = /Deno\.env\.get\(['\"]([^'\"]+)['\"]\)/g;
  for (const path of await sourceFiles('supabase/functions')) {
    const source = await readFile(path, 'utf8');
    for (const match of source.matchAll(pattern)) names.add(match[1]);
  }
  return [...names].sort();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertArrayEqual(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

const [
  html,
  routes,
  functions,
  migrations,
  advisors,
  smoke,
  vercel,
  configuration,
  verification,
] = await Promise.all([
  readFile('index.html'),
  readJson(`${recoveryRoot}/route-inventory.json`),
  readJson(`${recoveryRoot}/edge-functions.json`),
  readJson(`${recoveryRoot}/migrations.json`),
  readJson(`${recoveryRoot}/security-advisors.json`),
  readJson(`${recoveryRoot}/smoke-results.json`),
  readJson('.recovery-tmp/vercel-production.json'),
  readJson('.recovery-tmp/configuration.json'),
  readJson('.recovery-tmp/verification.json'),
]);

const capturedFunctions = functions.functions.filter((fn) => fn.status === 'captured');
const redactedFunctions = functions.functions.filter((fn) => fn.status === 'redacted');
const missingMigrations = migrations.migrations.filter((migration) => migration.status === 'missing');
const passedSmokeTests = smoke.tests.filter((result) => result.status === 'passed');
const expectedNames = await environmentVariableNames();
const expectedRedactedSlugs = [
  'add-member',
  'cancel-nurture-sequence',
  'crm-health',
  'member-onboarding-check',
  'send-nurture-email',
  'skool-sync',
  'trigger-nurture-sequence',
];

assert(functions.projectId === 'yzaxzmuuvozonhgwhlim', 'Unexpected Supabase project');
assert(functions.functions.length === 81, 'Expected exactly 81 deployed Edge Function records');
assert(capturedFunctions.length === 74, 'Expected exactly 74 byte-exact Edge Function captures');
assert(redactedFunctions.length === 7, 'Expected exactly seven credential-redacted Edge Functions');
assertArrayEqual(redactedFunctions.map((fn) => fn.slug), expectedRedactedSlugs, 'Unexpected credential-redaction set');
assert(redactedFunctions.every((fn) => fn.redactionReason.includes('NURTURE_WEBHOOK_SECRET')), 'Missing credential rotation requirement');
assert(migrations.migrations.length === 46 && missingMigrations.length === 46, 'Expected 46 unrecoverable historical migration sources');
assert(advisors.security.errorCount === 0, 'Security advisor errors must be zero');
assert(smoke.tests.length === 3 && passedSmokeTests.length === 3, 'All three smoke tests must pass');
assert(verification.secretScan === 'passed', 'Secret scan must pass before manifest assembly');
assert(['pending-history-rebuild', 'passed'].includes(verification.historySecretScan), 'Unexpected history attestation state');
if (verification.historySecretScan === 'passed') {
  execFileSync(process.execPath, ['tools/recovery/scan-history-secrets.mjs'], { stdio: 'pipe' });
}
assert(verification.edgeRecursiveDiff === 'passed', 'Edge recursive capture comparison must pass before manifest assembly');
assert(verification.smokeSuite === 'passed', 'Smoke suite must pass before manifest assembly');
assertArrayEqual(Object.keys(configuration).sort(), ['environmentVariableNames'], 'Configuration inventory must contain names only');
assertArrayEqual(configuration.environmentVariableNames, expectedNames, 'Configuration names must be exactly the names used by tracked source');
assert(vercel.projectId === 'prj_0Ju0B5KYjA8z9vrlghwTp2MhLUw2', 'Unexpected Vercel project');
assert(vercel.teamId === 'team_ePajvo1uCVVsbvJHZsXPrepW', 'Unexpected Vercel team');
assert(vercel.deploymentState === 'READY' && vercel.target === 'production', 'Deployment must be ready production');
assert(vercel.domainMappingVerified === true, 'Custom-domain mapping must be verified');
assertArrayEqual(vercel.customDomains, ['thestewardsrhythm.com', 'www.thestewardsrhythm.com'], 'Unexpected custom-domain mapping');

const inputs = await Promise.all(inputPaths.map(async (path) => {
  const content = await readFile(path);
  return { path, sha256: sha256(content), bytes: content.length };
}));
const schemaSnapshot = inputs.find((input) => input.path === 'supabase/baseline/2026-07-21-public-schema.sql');
const manifest = {
  capturedAt: new Date().toISOString(),
  git: {
    sourceCommit: 'aa706bc62fb58e7ce25ccda75381049801bda886',
    manifestParentCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  },
  html: {
    source: 'https://thestewardsrhythm.com/',
    sha256: sha256(html),
    bytes: html.length,
    routes,
  },
  vercel,
  supabase: {
    projectId: 'yzaxzmuuvozonhgwhlim',
    functions,
    migrations,
    schemaSnapshot: {
      path: schemaSnapshot.path,
      sha256: schemaSnapshot.sha256,
      bytes: schemaSnapshot.bytes,
      recoveryMethod: 'catalog-derived-select-only',
      replayable: false,
      historicalMigrationSourcesAvailable: false,
    },
    securityAdvisorErrors: advisors.security.errorCount,
  },
  configuration,
  verification,
  smoke,
  integrity: {
    inputs,
    counts: {
      functionRecords: functions.functions.length,
      capturedFunctions: capturedFunctions.length,
      redactedFunctions: redactedFunctions.length,
      migrationRecords: migrations.migrations.length,
      missingMigrationSources: missingMigrations.length,
      smokeTests: smoke.tests.length,
      passedSmokeTests: passedSmokeTests.length,
    },
  },
};

await writeJson(`${recoveryRoot}/production-manifest.json`, manifest);
