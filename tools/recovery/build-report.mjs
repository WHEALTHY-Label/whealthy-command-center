import { readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('docs/recovery/2026-07-21/production-manifest.json', 'utf8'));
const { counts } = manifest.integrity;
const redacted = manifest.supabase.functions.functions.filter((fn) => fn.status === 'redacted');
const failedSmoke = manifest.smoke.tests.filter((result) => result.status !== 'passed');
const environmentNames = manifest.configuration.environmentVariableNames.join(', ') || 'None detected in tracked source';
const historyStatus = manifest.verification.historySecretScan === 'passed'
  ? 'passed.'
  : `${manifest.verification.historySecretScan}. The current branch is expected to fail until the controller rebuilds it without the contaminated intermediate commit; it must pass before publication.`;

const report = `# WHEALTHY Production Recovery — 2026-07-21

## Outcome

This immutable recovery baseline records ${manifest.html.bytes.toLocaleString('en-US')} bytes of production HTML with SHA-256 \`${manifest.html.sha256}\`, ${counts.functionRecords} deployed Edge Function records, and ${counts.migrationRecords} remote migration-ledger records. The captured Vercel deployment is \`${manifest.vercel.deploymentId}\` (READY production) and is the deployment currently mapped to both \`thestewardsrhythm.com\` and \`www.thestewardsrhythm.com\`.

## Source Drift Reconciled

${counts.capturedFunctions} deployed Edge Functions are byte-exact captures. Seven functions are intentionally credential-redacted because production shared one embedded nurture webhook credential: ${redacted.map((fn) => `\`${fn.slug}\``).join(', ')}. Their recovered source uses \`NURTURE_WEBHOOK_SECRET\` and fails closed when that secret is absent; the reasons are recorded per function in the manifest and summarized in \`docs/recovery/2026-07-21/add-member-credential-redaction.md\`. Before any deployment of any listed function, rotate the prior nurture webhook credential and configure the replacement as the \`NURTURE_WEBHOOK_SECRET\` Edge Function secret. These are intentional safety boundaries, not omitted captures.

The remote migration ledger has ${counts.missingMigrationSources} historical migration sources unavailable in this checkout. Their current-state representation is the catalog-derived, SELECT-only schema snapshot at \`${manifest.supabase.schemaSnapshot.path}\` (SHA-256 \`${manifest.supabase.schemaSnapshot.sha256}\`). It is explicitly non-replayable and requires human review before any rebuild or migration work.

## Verification

- Read-only smoke tests: ${counts.passedSmokeTests}/${counts.smokeTests} passed.
- Error-level Supabase security advisor findings: ${manifest.supabase.securityAdvisorErrors}.
- Secret scan: ${manifest.verification.secretScan}.
- Branch-history secret scan: ${historyStatus}
- Edge capture recursive comparison: ${manifest.verification.edgeRecursiveDiff}.
- Diff hygiene: run \`node tools/recovery/verify-diff-hygiene.mjs\`. It permits whitespace findings only in hash-verified, byte-faithful \`index.html\` and exact-capture Edge Function files; redacted and generated files must remain clean.
- Production deployment target: ${manifest.vercel.target}; recovery branch: \`${manifest.git.branch}\`.

${failedSmoke.length ? `### Observed Smoke Failures\n\n${failedSmoke.map((result) => `- ${result.title}: ${result.error}`).join('\n')}` : 'No defects were observed by the read-only smoke suite.'}

## Configuration Inventory

Environment-variable names discovered only from tracked Edge Function source: ${environmentNames}.

No Vercel or Supabase environment values were requested, queried, or recorded.

## Rollback and Review Gate

Pre-recovery Git commit: \`${manifest.git.sourceCommit}\`. Captured production deployment: \`${manifest.vercel.deploymentId}\`. Manifest parent commit: \`${manifest.git.manifestParentCommit}\`.

Slice 1 planning may begin only after this report, the manifest integrity checks, and the recovery diff receive human approval.
`;

await writeFile('docs/recovery/2026-07-21/README.md', report, 'utf8');
