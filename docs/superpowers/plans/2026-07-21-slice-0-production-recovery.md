# Slice 0 Production Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the live WHEALTHY Vercel application, Supabase Edge Functions, and database migration state into a reviewed GitHub recovery branch that is safe to use as the Next.js migration baseline.

**Architecture:** Recovery is capture-first and non-deploying. Immutable production metadata and content are collected into a dated manifest, validated before promotion into tracked source paths, and verified with read-only smoke tests. Production remains unchanged; the final deliverable is a reviewed branch and annotated baseline tag.

**Tech Stack:** Node.js 24, Node built-in test runner, Playwright 1.61.1, static HTML, Git, Vercel project metadata, Supabase MCP/CLI, Deno Edge Functions

**Execution order:** Run tasks by task number (`1` through `8`). Task 2 is intentionally documented after Task 3 so the capture contract remains readable, but its secret scanner must be implemented first.

## Global Constraints

- Do not change or redeploy the production Vercel project during Slice 0.
- Do not deploy, delete, or alter a Supabase Edge Function during Slice 0.
- Do not execute tests that mutate production member data.
- Never record secret values; inventory environment-variable names only.
- Keep the existing static Vercel project configuration unchanged.
- Treat `https://thestewardsrhythm.com/` as the live HTML authority for the root application.
- Treat Supabase project `yzaxzmuuvozonhgwhlim` as the live backend authority.
- All recovered files must be inspected for secrets before staging.
- Use a dedicated recovery branch; do not push recovery commits directly to `main`.
- Use exact deployed bytes where recovery is intended to restore production source.
- Scripture text must remain sourced from the fixed library/API and must never be AI-generated.

---

## Planned File Structure

```text
docs/recovery/2026-07-21/
├── README.md                         # Human-readable recovery report
├── production-manifest.json          # Git, Vercel, Supabase, and capture identifiers
├── route-inventory.json              # Hash views and page entry points found in live HTML
├── edge-functions.json               # Deployed function versions and reconciliation status
├── migrations.json                   # Remote migration ledger and local-file status
├── security-advisors.json            # Advisor summary without table contents
└── smoke-results.json                 # Read-only verification results
tools/recovery/
├── package.json                      # Isolated recovery dependencies and commands
├── package-lock.json                 # Pinned dependency graph
├── lib/
│   ├── html.mjs                      # HTML validation and route extraction
│   ├── manifest.mjs                  # Stable manifest serialization and hashing
│   └── secrets.mjs                   # Secret-pattern scanner
├── capture-live-html.mjs             # Fetches and validates live HTML to a requested path
├── build-manifest.mjs                # Builds production-manifest.json from capture inputs
├── verify-edge-capture.mjs            # Compares recovered Edge Function trees
└── tests/
    ├── html.test.mjs                 # Unit tests for capture validation/inventory
    ├── manifest.test.mjs             # Unit tests for stable hashes and manifest schema
    ├── secrets.test.mjs              # Unit tests for secret scanning
    └── production-smoke.spec.mjs      # Read-only browser smoke tests
supabase/functions/<slug>/             # Exact recovered deployed function source
supabase/migrations/                    # Reconciled migration files from remote history
index.html                              # Exact validated live root HTML
```

`tools/recovery` is intentionally isolated so adding test dependencies cannot alter framework detection or installation behavior for the static Vercel project.

---

### Task 1: Create the Recovery Worktree and Manifest Primitives

**Files:**
- Create: `tools/recovery/package.json`
- Create: `tools/recovery/lib/manifest.mjs`
- Create: `tools/recovery/tests/manifest.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `sha256(value: string | Buffer): string`
- Produces: `stableJson(value: unknown): string`
- Produces: `writeJson(path: string, value: unknown): Promise<void>`
- Produces: recovery branch `recovery/production-baseline-2026-07-21`

- [ ] **Step 1: Create an isolated worktree from the approved design commit**

Run from the existing clone:

```bash
git status --short
git tag slice-0-plan-approved
git worktree add ../whealthy-production-recovery -b recovery/production-baseline-2026-07-21 slice-0-plan-approved
```

Expected: the first command reports a clean tree; the tag marks the approved plan commit; the worktree starts from that tag.

- [ ] **Step 2: Write the failing manifest tests**

Create `tools/recovery/tests/manifest.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256, stableJson } from '../lib/manifest.mjs';

test('stableJson sorts object keys recursively', () => {
  assert.equal(stableJson({ z: 1, a: { y: 2, b: 3 } }), '{\n  "a": {\n    "b": 3,\n    "y": 2\n  },\n  "z": 1\n}\n');
});

test('sha256 returns a lowercase 64-character digest', () => {
  assert.equal(sha256('whealthy'), 'c823f951e8b87fd5d91b3854912644fa5ac8ac2d63f0a29e05a7d9e85e9751fa');
});
```

- [ ] **Step 3: Run the test and verify the missing-module failure**

Run:

```bash
node --test tools/recovery/tests/manifest.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `tools/recovery/lib/manifest.mjs`.

- [ ] **Step 4: Implement the manifest primitives**

Create `tools/recovery/lib/manifest.mjs`:

```js
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stableJson(value), 'utf8');
}
```

Create `tools/recovery/package.json`:

```json
{
  "name": "whealthy-production-recovery",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "smoke": "playwright test tests/production-smoke.spec.mjs"
  },
  "devDependencies": {
    "@playwright/test": "1.61.1"
  }
}
```

Append these generated paths to `.gitignore`:

```gitignore
tools/recovery/node_modules/
tools/recovery/test-results/
tools/recovery/playwright-report/
.recovery-tmp/
```

- [ ] **Step 5: Install the isolated dependency and run the test**

Run:

```bash
npm install --prefix tools/recovery
node --test tools/recovery/tests/manifest.test.mjs
```

Expected: two passing tests and a new `tools/recovery/package-lock.json`.

- [ ] **Step 6: Commit the recovery foundation**

```bash
git add .gitignore tools/recovery/package.json tools/recovery/package-lock.json tools/recovery/lib/manifest.mjs tools/recovery/tests/manifest.test.mjs
git commit -m "chore(recovery): add production capture tooling"
```

---

### Task 3: Capture and Validate the Live Root Application

**Files:**
- Create: `tools/recovery/lib/html.mjs`
- Create: `tools/recovery/capture-live-html.mjs`
- Create: `tools/recovery/tests/html.test.mjs`
- Create: `docs/recovery/2026-07-21/route-inventory.json`
- Modify: `index.html`

**Interfaces:**
- Produces: `validateLiveHtml(html: string): { title: string, lineCount: number, byteLength: number }`
- Produces: `extractRouteInventory(html: string): { hashes: string[], entryPoints: string[] }`
- Consumes: `sha256()` and `writeJson()` from Task 1

- [ ] **Step 1: Write failing HTML validation tests**

Create `tools/recovery/tests/html.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRouteInventory, validateLiveHtml } from '../lib/html.mjs';

const valid = `<!DOCTYPE html>
<html><head><title>WHEALTHY — The Steward's Rhythm</title></head>
<body><script>
const SUPABASE_URL = 'https://yzaxzmuuvozonhgwhlim.supabase.co';
go('dash'); go('rhythm'); window.location.hash = view;
</script></body></html>`;

test('validateLiveHtml accepts the WHEALTHY document contract', () => {
  const result = validateLiveHtml(valid.repeat(5000));
  assert.equal(result.title, "WHEALTHY — The Steward's Rhythm");
  assert.ok(result.byteLength > 500_000);
});

test('validateLiveHtml rejects a login or proxy error page', () => {
  assert.throws(() => validateLiveHtml('<html>Redirecting...</html>'), /doctype/i);
});

test('extractRouteInventory returns sorted unique hash views', () => {
  assert.deepEqual(extractRouteInventory(valid).hashes, ['dash', 'rhythm']);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
node --test tools/recovery/tests/html.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `tools/recovery/lib/html.mjs`.

- [ ] **Step 3: Implement validation and route extraction**

Create `tools/recovery/lib/html.mjs`:

```js
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
```

- [ ] **Step 4: Implement the capture command**

Create `tools/recovery/capture-live-html.mjs`:

```js
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { extractRouteInventory, validateLiveHtml } from './lib/html.mjs';
import { sha256, writeJson } from './lib/manifest.mjs';

const outputFlag = process.argv.indexOf('--output');
if (outputFlag < 0 || !process.argv[outputFlag + 1]) throw new Error('Usage: --output <path>');

const target = resolve(process.argv[outputFlag + 1]);
const response = await fetch('https://thestewardsrhythm.com/', { redirect: 'follow' });
if (!response.ok) throw new Error(`Production returned HTTP ${response.status}`);
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
```

- [ ] **Step 5: Run unit tests and capture to the ignored staging directory**

Run:

```bash
node --test tools/recovery/tests/html.test.mjs
node tools/recovery/capture-live-html.mjs --output .recovery-tmp/live-index.html
shasum -a 256 .recovery-tmp/live-index.html index.html
```

Expected: three passing tests; capture validation succeeds; the live and repository digests differ before reconciliation.

- [ ] **Step 6: Promote the exact validated bytes and verify the digest**

Run:

```bash
cp .recovery-tmp/live-index.html index.html
shasum -a 256 .recovery-tmp/live-index.html index.html
git diff --stat -- index.html
```

Expected: both digests are identical; `git diff --stat` reports the recovered production delta.

- [ ] **Step 7: Scan and commit the recovered HTML**

Do not stage if the scan finds service-role keys, Stripe secret keys, private keys, or non-publishable API credentials. The scanner is implemented in Task 2 and must pass first.

```bash
node tools/recovery/scan-secrets.mjs index.html
git add index.html docs/recovery/2026-07-21/route-inventory.json tools/recovery/lib/html.mjs tools/recovery/capture-live-html.mjs tools/recovery/tests/html.test.mjs
git commit -m "chore(recovery): capture live production HTML"
```

---

### Task 2: Add a Blocking Secret Scanner

**Files:**
- Create: `tools/recovery/lib/secrets.mjs`
- Create: `tools/recovery/scan-secrets.mjs`
- Create: `tools/recovery/tests/secrets.test.mjs`

**Interfaces:**
- Produces: `scanSecrets(text: string): Array<{ kind: string, line: number }>`
- Produces: CLI exit code `1` when forbidden material is detected

- [ ] **Step 1: Write failing scanner tests**

Create `tools/recovery/tests/secrets.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSecrets } from '../lib/secrets.mjs';

test('allows the checked-in Supabase publishable anon JWT', () => {
  assert.deepEqual(scanSecrets("const SUPABASE_ANON='eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature';"), []);
});

test('blocks service-role and provider secret assignments', () => {
  const findings = scanSecrets("SUPABASE_SERVICE_ROLE_KEY='secret'\nSTRIPE_SECRET_KEY='sk_live_example'");
  assert.deepEqual(findings.map(({ kind }) => kind), ['supabase-service-role', 'stripe-secret']);
});

test('blocks PEM private keys', () => {
  assert.equal(scanSecrets('-----BEGIN PRIVATE KEY-----').length, 1);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test tools/recovery/tests/secrets.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `tools/recovery/lib/secrets.mjs`.

- [ ] **Step 3: Implement the scanner and CLI**

Create `tools/recovery/lib/secrets.mjs`:

```js
const rules = [
  ['supabase-service-role', /SUPABASE_SERVICE_ROLE(?:_KEY)?\s*[:=]/i],
  ['stripe-secret', /(?:STRIPE_SECRET_KEY\s*[:=]|\bsk_(?:live|test)_[A-Za-z0-9]+)/i],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['openai-key', /\bsk-proj-[A-Za-z0-9_-]{20,}/],
];

export function scanSecrets(text) {
  const findings = [];
  text.split('\n').forEach((line, index) => {
    for (const [kind, pattern] of rules) {
      if (pattern.test(line)) findings.push({ kind, line: index + 1 });
    }
  });
  return findings;
}
```

Create `tools/recovery/scan-secrets.mjs`:

```js
import { readFile } from 'node:fs/promises';
import { scanSecrets } from './lib/secrets.mjs';

const paths = process.argv.slice(2);
if (paths.length === 0) throw new Error('Provide at least one file path');
let failed = false;
for (const path of paths) {
  const findings = scanSecrets(await readFile(path, 'utf8'));
  for (const finding of findings) console.error(`${path}:${finding.line} ${finding.kind}`);
  failed ||= findings.length > 0;
}
process.exitCode = failed ? 1 : 0;
```

- [ ] **Step 4: Run all unit tests and scan tracked source**

Run:

```bash
npm test --prefix tools/recovery
node tools/recovery/scan-secrets.mjs index.html supabase/functions/*/index.ts
```

Expected: all tests pass and the scan exits `0`. If it exits `1`, stop and remove the secret from the recovery candidate without deleting it from the live system.

- [ ] **Step 5: Commit the scanner**

```bash
git add tools/recovery/lib/secrets.mjs tools/recovery/scan-secrets.mjs tools/recovery/tests/secrets.test.mjs
git commit -m "test(recovery): block secrets from baseline capture"
```

---

### Task 4: Reconcile Supabase Edge Function Source

**Files:**
- Create or modify: `supabase/functions/<deployed-slug>/**`
- Create: `docs/recovery/2026-07-21/edge-functions.json`
- Create: `tools/recovery/verify-edge-capture.mjs`

**Interfaces:**
- Consumes: Supabase MCP `list_edge_functions(project_id)` and `get_edge_function(project_id, function_slug)`
- Produces: one local directory per deployed function and a manifest containing `slug`, `version`, `verifyJwt`, `deployedSha256`, `localFiles`, and `status`

- [ ] **Step 1: Capture the deployed function inventory**

Call `list_edge_functions` for project `yzaxzmuuvozonhgwhlim`. Sort by slug and write only these non-secret fields to `docs/recovery/2026-07-21/edge-functions.json`:

```js
const inventory = {
  projectId: 'yzaxzmuuvozonhgwhlim',
  capturedAt: new Date().toISOString(),
  functions: deployedFunctions.map(({ slug, version, verify_jwt, ezbr_sha256 }) => ({
    slug,
    version,
    verifyJwt: verify_jwt,
    deployedSha256: ezbr_sha256,
    localFiles: [],
    status: 'pending',
  })),
};
```

The example shows the exact shape, not the complete inventory. The written array must contain every item returned by the live tool call.

- [ ] **Step 2: Fetch every deployed function into the ignored staging tree**

For every manifest slug, call `get_edge_function` and reproduce all returned source files under `.recovery-tmp/functions/<slug>/`. Do not infer missing files from neighboring functions. If one fetch fails, record `status: "capture_failed"` and stop before promotion.

- [ ] **Step 3: Implement capture verification**

Create `tools/recovery/verify-edge-capture.mjs`:

```js
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
for (const fn of manifest.functions) {
  const root = join('.recovery-tmp/functions', fn.slug);
  const paths = await filesUnder(root);
  if (paths.length === 0) throw new Error(`No files captured for ${fn.slug}`);
  fn.localFiles = [];
  for (const path of paths) {
    const content = await readFile(path);
    fn.localFiles.push({ path: relative(root, path), sha256: sha256(content), bytes: content.length });
  }
  fn.status = 'captured';
}
await writeJson(manifestPath, manifest);
console.log(`Verified ${manifest.functions.length} function captures`);
```

- [ ] **Step 4: Verify, scan, and promote the function trees**

Run:

```bash
node tools/recovery/verify-edge-capture.mjs
find .recovery-tmp/functions -type f -print0 | xargs -0 node tools/recovery/scan-secrets.mjs
```

Expected: every deployed slug reports `captured`; the secret scan exits `0`.

Promote each verified staging directory to the matching `supabase/functions/<slug>/` path. Existing directories must be replaced only after their staging copy passes validation. Do not delete local-only directories; record them as `local_only` in the manifest for review.

- [ ] **Step 5: Verify the promoted tree matches the capture**

Run a recursive file comparison for every slug:

```bash
for dir in .recovery-tmp/functions/*; do slug=${dir##*/}; diff -ru "$dir" "supabase/functions/$slug"; done
```

Expected: no diff output and exit code `0`.

- [ ] **Step 6: Commit Edge Functions by bounded domain**

Use separate commits so reviewers can reject one domain without rejecting the entire recovery:

```bash
git add supabase/functions/rhythm-* docs/recovery/2026-07-21/edge-functions.json
git commit -m "chore(recovery): capture deployed Rhythm functions"

git add supabase/functions/admin-* supabase/functions/onboarding-* supabase/functions/request-access supabase/functions/tour-state supabase/functions/member-*
git commit -m "chore(recovery): capture deployed member administration functions"

git add supabase/functions
git commit -m "chore(recovery): capture remaining deployed edge functions"
```

Expected: all deployed functions are tracked; `git status --short` contains no uncommitted function changes.

---

### Task 5: Reconcile the Supabase Migration Ledger and Schema

**Files:**
- Create: `docs/recovery/2026-07-21/migrations.json`
- Create: `docs/recovery/2026-07-21/security-advisors.json`
- Create or modify: `supabase/migrations/*.sql`
- Create: `supabase/baseline/2026-07-21-public-schema.sql`

**Interfaces:**
- Consumes: Supabase MCP `list_migrations`, `list_tables`, and `get_advisors`
- Produces: a complete remote migration ledger and a reviewable schema snapshot

- [ ] **Step 1: Record the complete remote migration ledger**

Call `list_migrations` for `yzaxzmuuvozonhgwhlim`. Write the sorted result to `docs/recovery/2026-07-21/migrations.json` using this exact shape:

```js
const ledger = {
  projectId: 'yzaxzmuuvozonhgwhlim',
  capturedAt: new Date().toISOString(),
  migrations: remoteMigrations.map(({ version, name }) => {
    const localFile = `supabase/migrations/${version}_${name}.sql`;
    return { version, name, localFile, status: existsSync(localFile) ? 'present' : 'missing' };
  }),
};
```

Every remote migration must appear. Set `status` to `present` only when a matching local file exists; otherwise use `missing`.

- [ ] **Step 2: Discover the current Supabase CLI workflow before using it**

Run:

```bash
npx supabase --help
npx supabase db --help
npx supabase db dump --help
```

Expected: help text identifies the installed CLI version and supported flags. Stop if the documented linked-project capture workflow is unavailable.

- [ ] **Step 3: Authenticate and link only after confirming the project ref**

Run:

```bash
npx supabase login
npx supabase link --project-ref yzaxzmuuvozonhgwhlim
```

Expected: the CLI confirms project `yzaxzmuuvozonhgwhlim`. Do not proceed if it shows another project.

- [ ] **Step 4: Produce a review-only public schema dump**

Dump the linked remote `public` schema without table data:

```bash
npx supabase db dump --linked --schema public --file .recovery-tmp/2026-07-21-public-schema.sql
```

Expected: a schema-only SQL file with no `COPY` or production row data. If the installed CLI rejects a listed flag, stop and reconcile the command against the `--help` output rather than substituting a guessed command.

Validate before promotion:

```bash
node tools/recovery/scan-secrets.mjs .recovery-tmp/2026-07-21-public-schema.sql
rg -n "INSERT INTO|COPY auth\.|COPY public\.|service_role_key|sk_live_|sk-ant-" .recovery-tmp/2026-07-21-public-schema.sql
```

Expected: secret scan exits `0`; `rg` prints no rows. Copy the validated file to `supabase/baseline/2026-07-21-public-schema.sql`.

- [ ] **Step 5: Preserve known migration source without mutating remote history**

Do not run `supabase db pull`, `supabase db push`, `apply_migration`, or any command that writes Supabase migration bookkeeping during recovery.

Create `supabase/migrations/20260722001453_harden_public_schema_rls_and_privileges.sql` using the exact SQL recorded in the applied migration review. Confirm its statements match the live policies and grants before staging.

For every earlier remote migration without a matching local file, keep `status: "missing"` in `migrations.json`. Do not invent historical SQL. The schema-only dump is the authoritative recovered representation of current state; the ledger preserves which historical sources remain unavailable.

- [ ] **Step 6: Verify the reconciled schema against live metadata**

Call `list_tables` with `schemas: ["public"]` and `verbose: true`. Call both security and performance advisors. Write `docs/recovery/2026-07-21/security-advisors.json` using:

```js
const advisorSummary = {
  capturedAt: new Date().toISOString(),
  security: {
    errorCount: securityLints.filter((lint) => lint.level === 'ERROR').length,
    warningCount: securityLints.filter((lint) => lint.level === 'WARN').length,
    names: [...new Set(securityLints.map((lint) => lint.name))].sort(),
  },
  performance: {
    errorCount: performanceLints.filter((lint) => lint.level === 'ERROR').length,
    warningCount: performanceLints.filter((lint) => lint.level === 'WARN').length,
    names: [...new Set(performanceLints.map((lint) => lint.name))].sort(),
  },
};
```

Do not record row contents.

Expected security state: zero error-level advisor findings. The intentional public/direct-client GraphQL notices must be identified as such rather than silently removed.

- [ ] **Step 7: Commit schema recovery separately**

```bash
git add supabase/migrations supabase/baseline/2026-07-21-public-schema.sql docs/recovery/2026-07-21/migrations.json docs/recovery/2026-07-21/security-advisors.json
git commit -m "chore(recovery): reconcile production database schema"
```

---

### Task 6: Add Read-Only Production Smoke Tests

**Files:**
- Create: `tools/recovery/tests/production-smoke.spec.mjs`
- Create: `docs/recovery/2026-07-21/smoke-results.json`

**Interfaces:**
- Consumes: production URL and public UI only
- Produces: deterministic pass/fail coverage without login or data mutation

- [ ] **Step 1: Write the production smoke suite**

Create `tools/recovery/tests/production-smoke.spec.mjs`:

```js
import { test, expect } from '@playwright/test';

const production = 'https://thestewardsrhythm.com/';

test('root application renders without uncaught errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(production, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("WHEALTHY — The Steward's Rhythm");
  await expect(page.locator('body')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('public application remains usable at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(production, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('page does not expose a service-role credential', async ({ request }) => {
  const response = await request.get(production);
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).not.toMatch(/SUPABASE_SERVICE_ROLE(?:_KEY)?\s*[:=]/i);
  expect(html).not.toMatch(/\bsk_live_[A-Za-z0-9]+/);
});
```

- [ ] **Step 2: Install the browser and run the read-only suite**

Run:

```bash
npm exec --prefix tools/recovery playwright install chromium
npm run smoke --prefix tools/recovery
```

Expected: three passing tests. Any production exception is recorded as a baseline defect and investigated before tagging.

- [ ] **Step 3: Record machine-readable results**

Run Playwright with its JSON reporter and transform only the suite name, test title, status, duration, production URL, and timestamp into `docs/recovery/2026-07-21/smoke-results.json` using:

```js
const smokeResults = {
  capturedAt: new Date().toISOString(),
  productionUrl: 'https://thestewardsrhythm.com/',
  tests: playwrightSuites.flatMap((suite) => suite.specs.map((spec) => ({
    suite: suite.title,
    title: spec.title,
    status: spec.ok ? 'passed' : 'failed',
    durationMs: spec.tests.flatMap((test) => test.results).reduce((sum, result) => sum + result.duration, 0),
    error: spec.ok ? null : spec.tests.flatMap((test) => test.results).find((result) => result.error)?.error?.message ?? 'Unknown failure',
  }))),
};
```

Do not record cookies, headers, HTML bodies, member data, or request payloads.

- [ ] **Step 4: Commit the smoke coverage**

```bash
git add tools/recovery/tests/production-smoke.spec.mjs docs/recovery/2026-07-21/smoke-results.json
git commit -m "test(recovery): verify production baseline read-only"
```

---

### Task 7: Build the Release Manifest and Recovery Report

**Files:**
- Create: `tools/recovery/build-manifest.mjs`
- Create: `tools/recovery/build-report.mjs`
- Create: `docs/recovery/2026-07-21/production-manifest.json`
- Create: `docs/recovery/2026-07-21/README.md`
- Create: `tools/recovery/tests/production-baseline.test.mjs`

**Interfaces:**
- Consumes: route, Edge Function, migration, Vercel, and smoke capture files
- Produces: one immutable baseline manifest and human review report

- [ ] **Step 1: Write the failing baseline-integrity test**

Create `tools/recovery/tests/production-baseline.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sha256 } from '../lib/manifest.mjs';

test('manifest points at the exact recovered index', async () => {
  const manifest = JSON.parse(await readFile('docs/recovery/2026-07-21/production-manifest.json', 'utf8'));
  const html = await readFile('index.html');
  assert.equal(manifest.html.sha256, sha256(html));
  assert.equal(manifest.supabase.projectId, 'yzaxzmuuvozonhgwhlim');
  assert.equal(manifest.vercel.projectId, 'prj_0Ju0B5KYjA8z9vrlghwTp2MhLUw2');
  assert.equal(manifest.vercel.deploymentState, 'READY');
});
```

- [ ] **Step 2: Run the test and verify the missing-manifest failure**

Run:

```bash
node --test tools/recovery/tests/production-baseline.test.mjs
```

Expected: FAIL with `ENOENT` for `production-manifest.json`.

- [ ] **Step 3: Capture Vercel deployment metadata**

Use Vercel project `prj_0Ju0B5KYjA8z9vrlghwTp2MhLUw2` and team `team_ePajvo1uCVVsbvJHZsXPrepW`. Write `.recovery-tmp/vercel-production.json` with `projectId`, `teamId`, `deploymentId`, `deploymentUrl`, `deploymentState`, `target`, `sourceRepository`, `sourceBranch`, `sourceCommit`, `sourceCommitMessage`, and `customDomains` from the current production deployment.

Derive required environment-variable names from tracked source with:

```bash
rg -o "Deno\.env\.get\(['\"][^'\"]+" supabase/functions | sed -E "s/.*Deno\.env\.get\(['\"]//" | sort -u
```

Write `.recovery-tmp/configuration.json` as `{ "environmentVariableNames": [sorted names] }`. Do not request or record values. After successful secret scanning and recursive Edge Function comparison, write `.recovery-tmp/verification.json` as:

```json
{
  "secretScan": "passed",
  "edgeRecursiveDiff": "passed"
}
```

- [ ] **Step 4: Implement manifest assembly**

Create `tools/recovery/build-manifest.mjs`:

```js
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { sha256, writeJson } from './lib/manifest.mjs';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const html = await readFile('index.html');
const routes = await readJson('docs/recovery/2026-07-21/route-inventory.json');
const functions = await readJson('docs/recovery/2026-07-21/edge-functions.json');
const migrations = await readJson('docs/recovery/2026-07-21/migrations.json');
const advisors = await readJson('docs/recovery/2026-07-21/security-advisors.json');
const smoke = await readJson('docs/recovery/2026-07-21/smoke-results.json');
const vercel = await readJson('.recovery-tmp/vercel-production.json');
const configuration = await readJson('.recovery-tmp/configuration.json');
const verification = await readJson('.recovery-tmp/verification.json');

const manifest = {
  capturedAt: new Date().toISOString(),
  git: {
    sourceCommit: 'aa706bc62fb58e7ce25ccda75381049801bda886',
    manifestParentCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  },
  html: { source: 'https://thestewardsrhythm.com/', sha256: sha256(html), bytes: html.length, routes },
  vercel,
  supabase: {
    projectId: 'yzaxzmuuvozonhgwhlim',
    functions,
    migrations,
    securityAdvisorErrors: advisors.security.errorCount,
  },
  configuration,
  verification,
  smoke,
};
await writeJson('docs/recovery/2026-07-21/production-manifest.json', manifest);
```

- [ ] **Step 5: Generate the manifest and make the test pass**

Run:

```bash
node tools/recovery/build-manifest.mjs
node --test tools/recovery/tests/production-baseline.test.mjs
npm test --prefix tools/recovery
git diff --check
```

Expected: baseline test passes; all recovery unit tests pass; no whitespace errors.

- [ ] **Step 6: Implement and generate the recovery report**

Create `tools/recovery/build-report.mjs`:

```js
import { readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('docs/recovery/2026-07-21/production-manifest.json', 'utf8'));
const functions = manifest.supabase.functions.functions;
const migrations = manifest.supabase.migrations.migrations;
const smokeTests = manifest.smoke.tests;
const failedSmoke = smokeTests.filter((test) => test.status !== 'passed');
const missingFunctions = functions.filter((fn) => fn.status !== 'captured').map((fn) => fn.slug);
const missingMigrations = migrations.filter((migration) => migration.status !== 'present').map((migration) => migration.localFile);
const environmentNames = manifest.configuration.environmentVariableNames.join(', ') || 'None detected in tracked source';

const report = `# WHEALTHY Production Recovery — 2026-07-21

## Outcome
The recovery capture contains the exact validated production HTML (${manifest.html.sha256}), ${functions.length} deployed Edge Function records, and ${migrations.length} remote migration records.

## Source Drift Reconciled
Unreconciled function captures: ${missingFunctions.length ? missingFunctions.join(', ') : 'None'}.
Unreconciled migration files: ${missingMigrations.length ? missingMigrations.join(', ') : 'None'}.

## Verification
Read-only smoke tests passed: ${smokeTests.length - failedSmoke.length}/${smokeTests.length}.
Error-level Supabase security advisor findings: ${manifest.supabase.securityAdvisorErrors}.
Secret scan: ${manifest.verification.secretScan}.
Edge capture recursive diff: ${manifest.verification.edgeRecursiveDiff}.

## Known Baseline Defects
${failedSmoke.length ? failedSmoke.map((test) => `- ${test.title}: ${test.error}`).join('\n') : 'None observed by the read-only smoke suite.'}

## Configuration Inventory
Environment-variable names discovered in tracked source: ${environmentNames}.
No Vercel or Supabase secret values were requested or captured.

## Rollback
Pre-recovery Git commit: ${manifest.git.sourceCommit}.
Captured production deployment: ${manifest.vercel.deploymentId}.
Recovery branch: ${manifest.git.branch}.

## Next Step
Slice 1 planning may begin only after this report, the recovery diff, and the production manifest receive human approval.
`;

await writeFile('docs/recovery/2026-07-21/README.md', report, 'utf8');
```

Run:

```bash
node tools/recovery/build-report.mjs
```

Expected: `docs/recovery/2026-07-21/README.md` contains measured values from the manifest and no secret values.

- [ ] **Step 7: Commit the manifest and report**

```bash
git add tools/recovery/build-manifest.mjs tools/recovery/build-report.mjs tools/recovery/tests/production-baseline.test.mjs docs/recovery/2026-07-21
git commit -m "docs(recovery): record verified production baseline"
```

---

### Task 8: Review, Publish the Recovery Branch, and Tag the Baseline

**Files:**
- Review: all files changed since `slice-0-plan-approved`
- Modify only if review identifies a concrete recovery defect

**Interfaces:**
- Produces: reviewed remote branch `recovery/production-baseline-2026-07-21`
- Produces: annotated tag `production-baseline-2026-07-21`
- Does not produce a Vercel or Supabase deployment

- [ ] **Step 1: Run the complete non-mutating verification suite**

```bash
npm test --prefix tools/recovery
npm run smoke --prefix tools/recovery
node tools/recovery/scan-secrets.mjs index.html supabase/functions/*/index.ts supabase/baseline/2026-07-21-public-schema.sql
git diff slice-0-plan-approved --check
git status --short
```

Expected: all tests pass, the secret scan exits `0`, diff check exits `0`, and the working tree is clean.

- [ ] **Step 2: Confirm no production mutation occurred**

Verify through Vercel that the current production deployment ID is unchanged from the captured manifest. Verify through Supabase that no new Edge Function versions or migrations appeared during recovery. If external changes occurred, refresh the affected captures and rerun verification before review.

- [ ] **Step 3: Review the full recovery diff**

```bash
git diff --stat slice-0-plan-approved..HEAD
git log --oneline --decorate slice-0-plan-approved..HEAD
```

Review HTML as a recovered binary-equivalent artifact, Edge Functions by bounded domain, schema SQL for destructive/data statements, and every manifest for secret values.

- [ ] **Step 4: Push the branch and open a draft pull request**

```bash
git push -u origin recovery/production-baseline-2026-07-21
```

Open a draft PR titled `chore: recover verified production baseline`. Include links to the design, this plan, recovery report, and manifest. State explicitly that the PR does not deploy production.

- [ ] **Step 5: Merge only after human review, then create the annotated tag**

After approval and merge:

```bash
git switch main
git pull --ff-only origin main
git tag -a production-baseline-2026-07-21 -m "Verified Vercel and Supabase production baseline before Next.js migration"
git push origin production-baseline-2026-07-21
```

Expected: `main` contains the reviewed recovery commits and the remote annotated tag points to the merge result.

- [ ] **Step 6: Close Slice 0**

Confirm the recovery report states that GitHub is the source of truth, the Vercel deployment remains unchanged, the Supabase backend remains unchanged, and Slice 1 may be planned from the tagged baseline.
