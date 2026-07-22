import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './lib/manifest.mjs';

const defaultRoot = fileURLToPath(new URL('../..', import.meta.url));
const recoveryRoot = 'docs/recovery/2026-07-21';

function parseFindings(output) {
  const findings = [];
  const errors = [];
  for (const line of output.split('\n')) {
    if (!line || line.startsWith('+')) continue;
    const match = line.match(/^(.+):(\d+): (.+)$/);
    if (!match) {
      errors.push(`Unrecognized git diff --check output: ${line}`);
      continue;
    }
    findings.push({ path: match[1], line: Number(match[2]), message: match[3] });
  }
  return { findings, errors };
}

export async function assessDiffHygiene({ root = defaultRoot, output }) {
  const { findings, errors } = parseFindings(output);
  const [routes, functions] = await Promise.all([
    readFile(resolve(root, recoveryRoot, 'route-inventory.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, recoveryRoot, 'edge-functions.json'), 'utf8').then(JSON.parse),
  ]);
  const allowedHashes = new Map([['index.html', routes.sha256]]);
  for (const fn of functions.functions.filter((item) => item.status === 'captured')) {
    for (const file of fn.localFiles) {
      allowedHashes.set(`supabase/functions/${fn.slug}/${file.path}`, file.sha256);
    }
  }

  const paths = new Set();
  for (const finding of findings) {
    if (!/^(?:trailing whitespace\.|new blank line at EOF\.|space before tab in indent\.)$/.test(finding.message)) {
      errors.push(`${finding.path}:${finding.line} is not an allowed whitespace finding: ${finding.message}`);
      continue;
    }
    if (!allowedHashes.has(finding.path)) {
      errors.push(`${finding.path}:${finding.line} is not an allowed byte-faithful capture`);
      continue;
    }
    paths.add(finding.path);
  }

  for (const path of paths) {
    const actual = sha256(await readFile(resolve(root, path)));
    if (actual !== allowedHashes.get(path)) {
      errors.push(`${path} hash does not match its recovery manifest`);
    }
  }

  return { ok: errors.length === 0, allowedFindings: findings.length, errors };
}

export async function verifyDiffHygiene({ root = defaultRoot } = {}) {
  const diff = spawnSync('git', ['diff', '--check', 'slice-0-plan-approved..HEAD'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (diff.error) throw diff.error;
  const output = `${diff.stdout ?? ''}${diff.stderr ?? ''}`;
  const result = await assessDiffHygiene({ root, output });
  if (diff.status !== 0 && output.trim().length === 0) {
    result.ok = false;
    result.errors.push(`git diff --check exited ${diff.status} without diagnostics`);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('Diff hygiene verification accepts no arguments');
  const result = await verifyDiffHygiene();
  for (const error of result.errors) console.error(error);
  if (result.ok) console.log(`Diff hygiene passed: ${result.allowedFindings} byte-faithful whitespace finding(s) allowed`);
  process.exitCode = result.ok ? 0 : 1;
}
