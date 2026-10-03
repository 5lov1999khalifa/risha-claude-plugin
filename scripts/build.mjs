import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const notices = path.join(root, 'vendor-notices');
await Promise.all([mkdir(dist, { recursive: true }), mkdir(notices, { recursive: true })]);
const bundle = await build({ absWorkingDir: root, entryPoints: ['src/stdio.js'], outfile: 'dist/server.mjs', bundle: true, platform: 'node', target: 'node22', format: 'esm', sourcemap: false, minify: false, metafile: true, legalComments: 'inline', logLevel: 'silent' });
const packageNames = [...new Set(Object.keys(bundle.metafile.inputs).flatMap(filename => {
  const normalized = filename.replaceAll('\\', '/');
  if (!normalized.startsWith('node_modules/')) return [];
  const parts = normalized.slice('node_modules/'.length).split('/');
  return [parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]];
}))].sort();
const dependencies = [];
for (const name of packageNames) {
  const packageRoot = path.join(root, 'node_modules', name);
  const metadata = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  let licenseContents, licenseFile;
  for (const filename of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'LICENSE-MIT']) {
    try { licenseContents = await readFile(path.join(packageRoot, filename), 'utf8'); licenseFile = filename; break; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!licenseContents) throw new Error(`Missing bundled runtime license: ${name}`);
  const noticeName = `${name.replaceAll('/', '__').replaceAll('@', '')}-${metadata.version}-LICENSE.txt`;
  await writeFile(path.join(notices, noticeName), licenseContents);
  dependencies.push({ name, version: metadata.version, license: metadata.license ?? null, sourceLicense: licenseFile, notice: noticeName });
}
const core = await readFile(path.join(root, 'src/screenplay.js'));
const digest = createHash('sha256').update(core).digest('hex');
await writeFile(path.join(notices, 'provenance.json'), JSON.stringify({ core: { source: '../risha-chatgpt-plugin/src/screenplay.js', copiedOn: '2026-10-03', upstreamSha256: '7f891b2930c5fcd4dea120241c7737e5eb47f9d05c6d9cf1a6eb3aa5b42413db', sha256: digest, adaptations: ['Host label changed from ChatGPT to Claude in the guide and source comments.'], behavior: 'TRF v1 creation, validation and revision behavior copied unchanged from the stateless core; no source repository changed.' }, dependencies }, null, 2));
const bundledBytes = (await readFile(path.join(dist, 'server.mjs'))).byteLength;
console.log(JSON.stringify({ output: 'dist/server.mjs', runtime: 'Node.js >=22', bundledBytes, reviewThresholdBytes: 256 * 1024, manualSizeReviewRequired: bundledBytes > 256 * 1024, bundledRuntimeDependencies: dependencies.map(({ name, version }) => `${name}@${version}`), coreSha256: digest }, null, 2));
