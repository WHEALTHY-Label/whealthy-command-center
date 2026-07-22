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
