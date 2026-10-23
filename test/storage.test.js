const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createStorage } = require('../storage.js');

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'cc-'));
const sample = (t) => ({ version: 3, notes: [{ id: 'n1', title: t, blocks: [] }], notebooks: [], openTabs: [] });

test('first run => empty (not an error)', async () => { const s = createStorage(await tmp()); assert.deepEqual(await s.load(), { status: 'empty' }); });
test('save then load round-trips exactly', async () => {
  const s = createStorage(await tmp()); const d = sample('héllo سلام'); await s.save(d);
  const r = await s.load(); assert.equal(r.status, 'ok'); assert.deepEqual(r.data, d);
});
test('second save keeps previous file as .bak', async () => {
  const s = createStorage(await tmp()); await s.save(sample('one')); await s.save(sample('two'));
  assert.equal(JSON.parse(await fs.readFile(s.bakPath, 'utf8')).notes[0].title, 'one');
  assert.equal((await s.load()).data.notes[0].title, 'two');
});
test('corrupt main file => recovered from .bak and corrupt copy preserved', async () => {
  const dir = await tmp(); const s = createStorage(dir); await s.save(sample('good')); await s.save(sample('good2'));
  await fs.writeFile(s.dataPath, '{"notes": [ truncated');
  const r = await s.load(); assert.equal(r.status, 'recovered'); assert.equal(r.data.notes[0].title, 'good');
  assert.ok(r.corruptCopy && (await fs.readFile(r.corruptCopy, 'utf8')).includes('truncated'));
});
test('corrupt file without backup => error status, never "empty"', async () => {
  const dir = await tmp(); const s = createStorage(dir); await fs.writeFile(s.dataPath, 'not json');
  const r = await s.load(); assert.equal(r.status, 'error'); assert.ok(r.corruptCopy);
  assert.equal(await fs.readFile(s.dataPath, 'utf8'), 'not json'); // untouched
});
test('invalid payloads are refused and do not touch existing data', async () => {
  const s = createStorage(await tmp()); await s.save(sample('keep'));
  for (const bad of [null, {}, { notes: 'x' }, 5]) await assert.rejects(() => s.save(bad));
  assert.equal((await s.load()).data.notes[0].title, 'keep');
});
test('no .tmp file left behind after save', async () => {
  const dir = await tmp(); const s = createStorage(dir); await s.save(sample('x'));
  assert.ok(!(await fs.readdir(dir)).some(f => f.endsWith('.tmp')));
});
test('v2 file gets a one-time .pre-v3 safety copy before migration', async () => {
  const dir = await tmp(); const s = createStorage(dir);
  await fs.writeFile(s.dataPath, JSON.stringify({ version: 2, notes: [{ id: 'old', title: 'legacy', blocks: [] }] }));
  await s.load(); await s.save({ version: 3, notes: [], notebooks: [], openTabs: [] }); await s.load();
  const pre = JSON.parse(await fs.readFile(path.join(dir, 'notebook.pre-v3.json'), 'utf8'));
  assert.equal(pre.notes[0].title, 'legacy');
});
