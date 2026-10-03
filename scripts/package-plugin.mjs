import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
const out = path.join(root, 'artifacts');
await mkdir(out, { recursive: true });
const entries = ['.claude-plugin/plugin.json', '.mcp.json', 'README.md', 'README.en.md', 'LICENSE'];
for (const folder of ['dist', 'skills', 'vendor-notices', 'docs']) {
  async function collect(relative) {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Distribution cannot contain symlinks.');
      const target = path.join(relative, entry.name);
      if (entry.isDirectory()) await collect(target);
      else if (entry.isFile()) entries.push(target);
    }
  }
  await collect(folder);
}
for (const file of entries) await readFile(path.join(root, file));
const zip = path.join(out, `risha-screenwriting-${manifest.version}.zip`);
// Create a fresh archive so an older ZIP cannot retain disallowed entries.
const temporary = path.join(out, `risha-screenwriting-${manifest.version}-${Date.now()}.zip`);
execFileSync('/usr/bin/zip', ['-q', temporary, ...entries], { cwd: root });
await writeFile(zip, await readFile(temporary));
await writeFile(path.join(out, 'package-receipt.json'), JSON.stringify({ plugin: manifest.name, version: manifest.version, zip, files: entries, officialDirectoryApproved: false }, null, 2));
console.log(`Packaged ${entries.length} runtime files: ${zip}`);
