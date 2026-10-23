// Electron-free persistence helpers (so they can be unit-tested with plain Node).
const path = require('node:path');
const fs = require('node:fs/promises');
const { constants: fsConstants } = require('node:fs');

const MAX_BYTES = 200 * 1024 * 1024; // sanity cap for one save payload
const isValidPayload = d => !!d && typeof d === 'object' && Array.isArray(d.notes);

function createStorage(dir) {
  const dataPath = path.join(dir, 'notebook.json');
  const bakPath = dataPath + '.bak';
  const readJson = async p => JSON.parse(await fs.readFile(p, 'utf8'));

  /**
   *   {status:'empty'}                         first run, no file yet
   *   {status:'ok', data}
   *   {status:'recovered', data, corruptCopy}  main file corrupt, .bak used
   *   {status:'error', message, corruptCopy}   nothing readable; renderer must NOT autosave
   */
  async function load() {
    let raw;
    try { raw = await fs.readFile(dataPath, 'utf8'); }
    catch (e) {
      if (e.code === 'ENOENT') {
        try { const d = await readJson(bakPath); if (isValidPayload(d)) return { status: 'recovered', data: d, corruptCopy: null }; } catch { /* none */ }
        return { status: 'empty' };
      }
      return { status: 'error', message: e.message, corruptCopy: null };
    }
    try {
      const d = JSON.parse(raw);
      if (!isValidPayload(d)) throw new Error('File does not contain a notes array');
      // One-time safety copy of pre-v3 data before the renderer migrates and rewrites it.
      if ((d.version || 0) < 3) {
        const pre = dataPath.replace(/\.json$/, '') + '.pre-v3.json';
        try { await fs.copyFile(dataPath, pre, fsConstants.COPYFILE_EXCL); } catch { /* already exists */ }
      }
      return { status: 'ok', data: d };
    } catch (parseErr) {
      let corruptCopy = null;
      try { corruptCopy = dataPath.replace(/\.json$/, '') + '.corrupt-' + Date.now() + '.json'; await fs.copyFile(dataPath, corruptCopy); } catch { corruptCopy = null; }
      try { const d = await readJson(bakPath); if (isValidPayload(d)) return { status: 'recovered', data: d, corruptCopy }; } catch { /* no usable backup */ }
      return { status: 'error', message: parseErr.message, corruptCopy };
    }
  }

  async function save(data) {
    if (!isValidPayload(data)) throw new Error('Refusing to save: invalid notebook payload');
    const json = JSON.stringify(data, null, 2);
    if (Buffer.byteLength(json) > MAX_BYTES) throw new Error('Notebook is too large to save');
    const tmp = dataPath + '.tmp';
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    try { await fs.copyFile(dataPath, bakPath); } catch { /* first save */ }
    await fs.writeFile(tmp, json, 'utf8');
    await fs.rename(tmp, dataPath);
    return true;
  }
  return { load, save, dataPath, bakPath };
}
module.exports = { createStorage, isValidPayload };
