import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { scanSecrets } from './lib/secrets.mjs';

const args = process.argv.slice(2);
const recursive = args[0] === '--recursive';
const paths = recursive ? args.slice(1) : args;
if (paths.length === 0) throw new Error('Provide at least one file path');

async function filesUnder(path) {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink()) throw new Error(`Refusing to scan symbolic link: ${path}`);
  if (metadata.isFile()) return [path];
  if (!metadata.isDirectory()) throw new Error(`Unsupported scan input: ${path}`);
  if (!recursive) throw new Error(`Directory input requires --recursive: ${path}`);
  const files = [];
  for (const name of (await readdir(path)).sort()) {
    files.push(...await filesUnder(join(path, name)));
  }
  return files;
}

let failed = false;
const files = [...new Set((await Promise.all(paths.map(filesUnder))).flat())].sort();
for (const path of files) {
  const findings = scanSecrets(await readFile(path, 'utf8'));
  for (const finding of findings) console.error(`${path}:${finding.line} ${finding.kind}`);
  failed ||= findings.length > 0;
}
process.exitCode = failed ? 1 : 0;
