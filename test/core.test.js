const test = require('node:test');
const assert = require('node:assert/strict');
const CC = require('../src/renderer/core.js');

test('migrate: v2 data keeps content and gains geometry', () => {
  const out = CC.migrate({ version: 2, notes: [{ id: 'n', title: 'T', blocks: [
    { id: 'a', type: 'text', content: 'hi', html: '<b>hi</b>', x: 10, y: 20, w: 300 },
    { id: 'b', type: 'code', content: 'x=1' },
    { id: 'c', type: 'drawing', strokes: [{ points: [] }] },
    { id: 'd', type: 'future', extra: 5 }] }], notebooks: [{ id: 'js', name: 'JS' }], openTabs: ['n', 'ghost'] });
  assert.equal(out.version, CC.SCHEMA_VERSION);
  const [a, b, c, d] = out.notes[0].blocks;
  assert.equal(a.content, 'hi'); assert.equal(a.html, '<b>hi</b>'); assert.equal(a.x, 10); assert.equal(a.w, 300); assert.equal(a.h, null); // text height fitted by renderer
  assert.equal(b.language, 'javascript'); assert.equal(b.h, CC.defaultSize('code').h);
  assert.equal(c.strokes.length, 1); assert.equal(d.extra, 5);
  assert.deepEqual(out.openTabs, ['n']);
});
test('migrate: never throws on garbage and returns usable empty state', () => {
  for (const bad of [null, undefined, 5, 'x', [], { notes: 'nope' }, { notes: [null, 3, { blocks: 'x' }] }]) {
    const o = CC.migrate(bad); assert.ok(Array.isArray(o.notes)); assert.equal(o.version, CC.SCHEMA_VERSION);
  }
});
test('migrate: duplicate ids are repaired, not dropped', () => {
  const o = CC.migrate({ notes: [{ id: 'n', blocks: [{ id: 'a', type: 'text' }, { id: 'a', type: 'text' }] }, { id: 'n', blocks: [] }] });
  assert.equal(o.notes.length, 2); assert.notEqual(o.notes[0].id, o.notes[1].id);
  assert.notEqual(o.notes[0].blocks[0].id, o.notes[0].blocks[1].id);
});
test('migrate is idempotent', () => {
  const once = CC.migrate({ notes: [{ id: 'n', blocks: [{ id: 'a', type: 'image', url: 'https://x/y.png', w: 200, h: 100, x: 5, y: 6 }] }] });
  assert.deepEqual(CC.migrate(once), once);
});
test('computeResize: se grows, opposite corner fixed', () => {
  const r = CC.computeResize({ x: 100, y: 100, w: 300, h: 200 }, 'se', 50, 30, { type: 'text' });
  assert.deepEqual(r, { x: 100, y: 100, w: 350, h: 230 });
});
test('computeResize: nw moves origin and keeps se corner fixed', () => {
  const r = CC.computeResize({ x: 100, y: 100, w: 300, h: 200 }, 'nw', -40, -20, { type: 'text' });
  assert.deepEqual(r, { x: 60, y: 80, w: 340, h: 220 });
});
test('computeResize: clamps to minimum for every type and keeps anchor', () => {
  for (const type of Object.keys(CC.MIN_SIZE)) {
    if (type === '_other') continue;
    const s = { x: 500, y: 400, w: 600, h: 500 }; const m = CC.minSize(type);
    const r = CC.computeResize(s, 'nw', 5000, 5000, { type });
    assert.equal(r.w, m.w, type); assert.equal(r.h, m.h, type);
    assert.equal(r.x + r.w, s.x + s.w, type); assert.equal(r.y + r.h, s.y + s.h, type);
    const r2 = CC.computeResize(s, 'se', -5000, -5000, { type });
    assert.deepEqual([r2.w, r2.h], [m.w, m.h]); assert.deepEqual([r2.x, r2.y], [s.x, s.y]);
  }
});
test('computeResize: never produces negative origin', () => {
  const r = CC.computeResize({ x: 20, y: 10, w: 300, h: 200 }, 'nw', -500, -500, { type: 'text' });
  assert.ok(r.x >= 0 && r.y >= 0);
  assert.equal(r.x + r.w, 320); assert.equal(r.y + r.h, 210);
});
test('computeResize: lockRatio keeps aspect ratio on corners', () => {
  const s = { x: 50, y: 50, w: 400, h: 200 };
  for (const dir of ['se', 'sw', 'ne', 'nw']) for (const [dx, dy] of [[60, 5], [-80, 10], [5, 70], [-30, -90]]) {
    const r = CC.computeResize(s, dir, dx, dy, { type: 'image', lockRatio: true });
    assert.ok(Math.abs(r.w / r.h - 2) < 0.03, `${dir} ${dx},${dy} -> ${JSON.stringify(r)}`);
  }
});
test('computeResize: edge handles change a single axis', () => {
  const s = { x: 10, y: 10, w: 300, h: 200 };
  assert.deepEqual(CC.computeResize(s, 'e', 40, 99, { type: 'text' }), { x: 10, y: 10, w: 340, h: 200 });
  assert.deepEqual(CC.computeResize(s, 's', 99, 25, { type: 'text' }), { x: 10, y: 10, w: 300, h: 225 });
  assert.deepEqual(CC.computeResize(s, 'w', 30, 0, { type: 'text' }), { x: 40, y: 10, w: 270, h: 200 });
  assert.deepEqual(CC.computeResize(s, 'n', 0, 30, { type: 'text' }), { x: 10, y: 40, w: 300, h: 170 });
});
test('computeResize: respects MAX_DIM', () => {
  const r = CC.computeResize({ x: 0, y: 0, w: 300, h: 200 }, 'se', 99999, 99999, { type: 'text' });
  assert.equal(r.w, CC.MAX_DIM); assert.equal(r.h, CC.MAX_DIM);
});
test('computeMove never goes negative', () => { assert.deepEqual(CC.computeMove({ x: 10, y: 10 }, -50, -50), { x: 0, y: 0 }); });
test('containFit letterboxes without distortion', () => {
  const f = CC.containFit(1200, 650, 600, 600); assert.ok(Math.abs(f.w / f.h - 1200 / 650) < 1e-9); assert.ok(f.w <= 600 && f.h <= 600);
  assert.ok(Math.abs(f.ox * 2 + f.w - 600) < 1e-9 && Math.abs(f.oy * 2 + f.h - 600) < 1e-9);
});
test('contentExtent / nextPosition', () => {
  const bl = [{ x: 10, y: 10, w: 100, h: 50 }, { x: 500, y: 300, w: 200, h: 100 }];
  assert.deepEqual(CC.contentExtent(bl), { w: 700, h: 400 }); assert.equal(CC.nextPosition(bl).y, 428); assert.deepEqual(CC.nextPosition([]), { x: 30, y: 25 });
});
