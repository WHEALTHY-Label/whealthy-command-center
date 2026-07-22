import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const scanner = resolve(repoRoot, 'tools/recovery/scan-secrets.mjs');
const historyScanner = resolve(repoRoot, 'tools/recovery/scan-history-secrets.mjs');

test('recursive scanning finds nested credentials without printing values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'whealthy-secret-tree-'));
  const nested = join(root, 'nested');
  await mkdir(nested);
  const value = 'synthetic-webhook-value';
  await writeFile(join(nested, 'source.ts'), `const WEBHOOK_SECRET = '${value}';\n`);
  const result = spawnSync(process.execPath, [scanner, '--recursive', root], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /generic-credential-assignment/);
  assert.doesNotMatch(result.stderr, new RegExp(value));
});

test('history scanning fails on a reachable secret and ignores unreachable branch history', async () => {
  const root = await mkdtemp(join(tmpdir(), 'whealthy-secret-history-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.name', 'Recovery Test');
  git('config', 'user.email', 'recovery-test@example.invalid');

  const value = 'synthetic-history-secret';
  await writeFile(join(root, 'source.ts'), `const WEBHOOK_SECRET = '${value}';\n`);
  git('add', 'source.ts');
  git('commit', '-qm', 'contaminated fixture');

  const contaminated = spawnSync(process.execPath, [historyScanner], { cwd: root, encoding: 'utf8' });
  assert.equal(contaminated.status, 1);
  assert.match(contaminated.stderr, /generic-credential-assignment/);
  assert.doesNotMatch(contaminated.stderr, new RegExp(value));

  git('checkout', '--orphan', 'clean');
  git('rm', '-rf', '.');
  await writeFile(join(root, 'README.md'), 'clean branch\n');
  git('add', 'README.md');
  git('commit', '-qm', 'clean fixture');

  const clean = spawnSync(process.execPath, [historyScanner], { cwd: root, encoding: 'utf8' });
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /reachable from HEAD/);
});
