import { execFileSync } from 'node:child_process';
import { scanSecrets } from './lib/secrets.mjs';

if (process.argv.length !== 2) {
  throw new Error('History attestation scans the current branch HEAD only and accepts no ref arguments');
}

const fixturePaths = new Set([
  'docs/CHANGELOG-2026-07-13.md',
  'docs/superpowers/plans/2026-07-21-slice-0-production-recovery.md',
  'tools/recovery/tests/secrets.test.mjs',
  'tools/recovery/tests/secrets-cli.test.mjs',
]);

const options = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
const objectLines = execFileSync('git', ['rev-list', '--objects', 'HEAD'], options)
  .trim()
  .split('\n')
  .filter(Boolean);
const pathsByObject = new Map();
for (const line of objectLines) {
  const separator = line.indexOf(' ');
  const object = separator === -1 ? line : line.slice(0, separator);
  const path = separator === -1 ? `[object:${object.slice(0, 12)}]` : line.slice(separator + 1);
  if (!pathsByObject.has(object)) pathsByObject.set(object, path);
}

const objects = [...pathsByObject.keys()];
const batchInput = `${objects.join('\n')}\n`;
const types = execFileSync(
  'git',
  ['cat-file', '--batch-check=%(objectname) %(objecttype)'],
  { ...options, input: batchInput },
).trim().split('\n');

let failed = false;
let scanned = 0;
for (const line of types) {
  const [object, type] = line.split(' ');
  if (type !== 'blob') continue;
  const content = execFileSync('git', ['cat-file', 'blob', object], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const findings = scanSecrets(content);
  const path = pathsByObject.get(object) ?? `[blob:${object.slice(0, 12)}]`;
  if (fixturePaths.has(path)) {
    scanned += 1;
    continue;
  }
  for (const finding of findings) {
    console.error(`${path}@${object.slice(0, 12)}:${finding.line} ${finding.kind}`);
  }
  failed ||= findings.length > 0;
  scanned += 1;
}

if (!failed) console.log(`Scanned ${scanned} blobs reachable from HEAD`);
process.exitCode = failed ? 1 : 0;
