import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { LIMITS } from '../src/screenplay.js';

const entry = fileURLToPath(new URL('../dist/server.mjs', import.meta.url));
const rawStdinLimit = 2 * LIMITS.bytes + 16 * 1024;
const sample = () => ({ title: 'الباب', language: 'ar', scenes: [{ title: 'داخلي - مجلس - ليل', blocks: [{ type: 'action', text: 'ينظر سالم نحو الباب. 😀' }, { type: 'character', text: 'سالم' }, { type: 'parenthetical', text: '(بهمس)' }, { type: 'dialogue', text: 'منو برع؟' }] }] });
const blocks = project => project.chapters.flatMap(chapter => chapter.scenes.flatMap(scene => scene.blocks));

async function withClient(run, options = {}) {
  const client = new Client({ name: 'risha-claude-bundle-test', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [options.entry ?? entry], cwd: options.cwd, stderr: 'pipe' });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
  try {
    await client.connect(transport, { timeout: 5000 });
    const call = (name, args = {}) => client.callTool({ name, arguments: args }, undefined, { timeout: 5000 });
    const value = async (name, args = {}) => {
      const result = await call(name, args);
      assert.equal(result.isError, undefined, result.content?.[0]?.text);
      assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
      return result.structuredContent;
    };
    await run({ client, call, value, getStderr: () => stderr });
  } finally { await client.close(); }
}

test('bundled official stdio lifecycle advertises exactly four local bounded tools', { timeout: 15000 }, async () => {
  await withClient(async ({ client, getStderr }) => {
    assert.equal(client.getServerVersion().name, 'risha-screenwriting');
    assert.match(client.getInstructions(), /does not author prose, read or write files/);
    assert.match(client.getInstructions(), /NEW .trf file only when the writer asks/);
    const result = await client.listTools();
    assert.deepEqual(result.tools.map(tool => tool.name), ['get_screenwriting_guide', 'build_risha_screenplay', 'validate_risha_screenplay', 'revise_risha_screenplay']);
    for (const tool of result.tools) {
      assert.equal(tool.annotations.readOnlyHint, true);
      assert.equal(tool.annotations.destructiveHint, false);
      assert.equal(tool.annotations.openWorldHint, false);
      assert.ok(tool.outputSchema);
      assert.equal(tool.inputSchema.additionalProperties, false);
      assert.equal(tool._meta, undefined);
    }
    const schema = result.tools.find(tool => tool.name === 'build_risha_screenplay').inputSchema;
    assert.equal(schema.properties.scenes.maxItems, 200);
    assert.equal(schema.properties.scenes.items.properties.blocks.maxItems, 10000);
    assert.equal(getStderr(), '');
  });
});

test('guide exposes Arabic fusha directions, requested dialogue dialect and preservation instructions', { timeout: 15000 }, async () => {
  await withClient(async ({ value, call }) => {
    const { guide } = await value('get_screenwriting_guide', { language: 'ar', dialogueDialect: 'الإماراتية' });
    assert.equal(guide.language, 'ar');
    assert.equal(guide.dialogueDialect, 'الإماراتية');
    assert.equal(guide.scriptDirection, 'rtl');
    assert.ok(guide.instructions.some(rule => rule.includes('الفصحى')));
    assert.ok(guide.instructions.some(rule => rule.includes('Claude')));
    assert.equal(guide.limits.bytes, LIMITS.bytes);
    assert.equal((await value('get_screenwriting_guide', { language: 'en', dialogueDialect: 'Scottish English' })).guide.dialogueDialect, 'Scottish English');
    assert.equal((await call('get_screenwriting_guide', { dialogueDialect: ' ' })).isError, true);
  });
});

test('build returns complete exact Arabic TRF JSON and suggested filename without writing any file', { timeout: 15000 }, async () => {
  const isolated = await mkdtemp(path.join(tmpdir(), 'risha-claude-stdio-'));
  try {
    // This copied single file has no node_modules beside or above it: bundled
    // dependencies must be sufficient, and the tool must create no local files.
    const isolatedEntry = path.join(isolated, 'server.mjs');
    await writeFile(isolatedEntry, await readFile(entry));
    await withClient(async ({ value }) => {
      const input = sample(), original = structuredClone(input);
      const result = await value('build_risha_screenplay', input);
      assert.deepEqual(input, original);
      assert.equal(result.kind, 'screenplay');
      assert.equal(result.file.name, 'الباب-draft.trf');
      assert.equal(result.file.mimeType, 'application/json');
      assert.equal(result.project.titlePage.author, '');
      assert.equal(result.project.format, 'trf');
      assert.equal(result.project.version, 1);
      assert.equal(result.summary.scenes, 1);
      assert.equal(result.summary.blocks, 5);
      assert.deepEqual(blocks(result.project).map(block => [block.type, block.text]), [['scene', input.scenes[0].title], ...input.scenes[0].blocks.map(block => [block.type, block.text])]);
      assert.equal((await value('validate_risha_screenplay', { project: result.project })).valid, true);
      assert.deepEqual(await readdir(isolated), ['server.mjs']);
    }, { entry: isolatedEntry, cwd: isolated });
    assert.deepEqual(await readdir(isolated), ['server.mjs']);
  } finally { await rm(isolated, { recursive: true, force: true }); }
});

test('English all-block-types build retains UTF-16 emoji marks and deterministic structural warnings', { timeout: 15000 }, async () => {
  await withClient(async ({ value }) => {
    const input = { title: 'The Signal', author: 'Test writer', language: 'en', filmLength: 'feature', scenes: [{ title: 'INT. ROOM - NIGHT', blocks: [
      { type: 'action', text: 'A light 😀 flickers.', marks: [{ type: 'bold', start: 8, end: 10 }] },
      { type: 'character', text: 'MAYA' }, { type: 'parenthetical', text: '(quietly)' }, { type: 'dialogue', text: 'Listen.' }, { type: 'shot', text: 'CLOSE ON RADIO' }, { type: 'transition', text: 'CUT TO:' }
    ] }] };
    const result = await value('build_risha_screenplay', input);
    assert.equal(result.project.scriptDirection, 'ltr');
    assert.equal(result.project.projectProfile.filmLength, 'feature');
    assert.deepEqual(blocks(result.project).map(block => block.type), ['scene', 'action', 'character', 'parenthetical', 'dialogue', 'shot', 'transition']);
    assert.deepEqual(blocks(result.project)[1].marks, [{ type: 'bold', start: 8, end: 10 }]);
    assert.equal(blocks(result.project)[1].text.slice(8, 10), '😀');
    const orphan = structuredClone(result.project); blocks(orphan)[2].type = 'action';
    const validation = await value('validate_risha_screenplay', { project: orphan });
    assert.equal(validation.valid, true);
    assert.ok(validation.warnings.some(warning => warning.includes('dialogue has no preceding character')));
  });
});

test('revisions preserve source IDs, own __proto__ and unknown nested metadata, with safe atomic errors', { timeout: 15000 }, async () => {
  await withClient(async ({ value, call }) => {
    const original = (await value('build_risha_screenplay', sample())).project;
    original.future = { label: 'بيانات محفوظة', values: ['😀', null, true, Number.MAX_SAFE_INTEGER] };
    original.chapters[0].futureChapter = { keep: true };
    original.chapters[0].scenes[0].futureScene = { label: 'ملاحظة' };
    Object.defineProperty(original, '__proto__', { value: { preserved: 'source data' }, enumerable: true, configurable: true, writable: true });
    const target = blocks(original).find(block => block.type === 'dialogue');
    target.futureBlock = { continuity: 'retain' };
    const sourceJson = JSON.stringify(original);
    const revised = await value('revise_risha_screenplay', { project: original, changes: [{ blockId: target.id, text: 'لحظة، بفتح الباب.' }] });
    const expected = JSON.parse(sourceJson); blocks(expected).find(block => block.id === target.id).text = 'لحظة، بفتح الباب.';
    assert.deepEqual(revised.project, expected);
    assert.equal(Object.hasOwn(revised.project, '__proto__'), true);
    assert.deepEqual(revised.changedBlockIds, [target.id]);
    assert.equal(JSON.stringify(original), sourceJson);
    const failed = await call('revise_risha_screenplay', { project: original, changes: [{ blockId: target.id, text: 'first requested edit' }, { blockId: 'confidential-missing-id', text: 'private screenplay text' }] });
    assert.equal(failed.isError, true);
    assert.equal(JSON.stringify(failed).includes('private screenplay text'), false);
    assert.equal(JSON.stringify(failed).includes('confidential-missing-id'), false);
    assert.equal((await value('validate_risha_screenplay', { project: original })).valid, true);
    assert.equal(JSON.stringify(original), sourceJson);
  });
});

test('marked text and production/omitted protections survive the stdio boundary', { timeout: 15000 }, async () => {
  await withClient(async ({ value, call }) => {
    const original = (await value('build_risha_screenplay', sample())).project;
    const target = blocks(original)[1];
    target.marks = [{ type: 'bold', start: target.text.length - 2, end: target.text.length }];
    assert.equal((await call('revise_risha_screenplay', { project: original, changes: [{ blockId: target.id, text: 'نص جديد 😀' }] })).isError, true);
    const adjusted = await value('revise_risha_screenplay', { project: original, changes: [{ blockId: target.id, text: 'نص جديد 😀', marks: [{ type: 'bold', start: 8, end: 10 }] }] });
    assert.deepEqual(blocks(adjusted.project)[1].marks, [{ type: 'bold', start: 8, end: 10 }]);
    const cleared = await value('revise_risha_screenplay', { project: original, changes: [{ blockId: target.id, text: 'نص جديد', marks: [] }] });
    assert.deepEqual(blocks(cleared.project)[1].marks, []);
    for (const [field, data] of [['locks', [{ color: 'blue' }]], ['activeRevision', {}], ['revisionSnapshot', { baseline: true }]]) {
      const locked = structuredClone(original); locked[field] = data;
      assert.equal((await value('validate_risha_screenplay', { project: locked })).valid, true);
      assert.equal((await call('revise_risha_screenplay', { project: locked, changes: [] })).isError, true);
    }
    const omitted = structuredClone(original); omitted.chapters[0].scenes[0].omitted = true;
    assert.equal((await call('revise_risha_screenplay', { project: omitted, changes: [{ blockId: target.id, text: 'تغيير', marks: [] }] })).isError, true);
  });
});

test('unsupported schemas, unsafe unknown numbers, IDs, block types and limits are rejected', { timeout: 15000 }, async () => {
  await withClient(async ({ value, call }) => {
    const original = (await value('build_risha_screenplay', sample())).project;
    for (const change of [p => { p.version = 2; }, p => { p.futureNumber = Number.MAX_SAFE_INTEGER + 1; }, p => { blocks(p)[1].id = blocks(p)[0].id; }, p => { blocks(p)[1].type = 'unsupported'; }, p => { p.extra = 'x'.repeat(LIMITS.bytes); }]) {
      const invalid = structuredClone(original); change(invalid);
      const result = await value('validate_risha_screenplay', { project: invalid });
      assert.equal(result.valid, false);
      assert.ok(result.errors.length);
    }
    const tooManyScenes = sample(); tooManyScenes.scenes = Array.from({ length: 201 }, () => ({ title: 'INT. ROOM - DAY', blocks: [] }));
    assert.equal((await call('build_risha_screenplay', tooManyScenes)).isError, true);
    const tooManyBlocks = sample(); tooManyBlocks.scenes[0].blocks = Array.from({ length: 10000 }, () => ({ type: 'action', text: '' }));
    assert.equal((await call('build_risha_screenplay', tooManyBlocks)).isError, true);
    const unauthorized = await call('build_risha_screenplay', { ...sample(), accountToken: 'never-echo-this-secret' });
    assert.equal(unauthorized.isError, true);
    assert.equal(JSON.stringify(unauthorized).includes('never-echo-this-secret'), false);
    assert.equal((await call('save_file', { destination: '/must-not-write', project: original })).isError, true);
    assert.equal((await call('delete_cloud_project')).isError, true);
  });
});

test('raw oversized stdio input closes safely without echoing document contents', { timeout: 15000 }, async () => {
  const child = spawn(process.execPath, [entry], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const completion = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  try {
    child.stdin.on('error', () => {});
    child.stdin.end('PRIVATE-CONTENT'.repeat(Math.ceil((rawStdinLimit + 1) / 15)));
    const status = await Promise.race([completion, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Bounded stdio transport did not close.')), 5000); timer.unref(); })]);
    assert.equal(status.code, 0);
    assert.equal(stdout, '');
    assert.match(stderr, /could not process a protocol message/);
    assert.equal(stderr.includes('PRIVATE-CONTENT'), false);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); }
});
