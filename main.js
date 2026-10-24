const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const { createStorage, isValidPayload } = require('./storage');
let storage; // created after app is ready (needs userData path)

function createWindow() {
  const win = new BrowserWindow({
    width: 1480, height: 940, minWidth: 1000, minHeight: 650,
    backgroundColor: '#0b0d12', title: 'CodeCanvas',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Ask the renderer to flush any debounced edit before the window really closes.
  let allowClose = false, closeTimer = null;
  const finishClose = () => { allowClose = true; clearTimeout(closeTimer); if (!win.isDestroyed()) win.close(); };
  win.on('close', e => {
    if (allowClose || win.webContents.isDestroyed() || win.webContents.isLoading()) return;
    e.preventDefault();
    if (closeTimer) return; // already waiting
    win.webContents.send('app:before-close');
    closeTimer = setTimeout(finishClose, 4000); // never trap the user if the renderer hangs
  });
  win.webContents.ipc.on('app:close-ready', finishClose);
  return win;
}

app.whenReady().then(() => {
  storage = createStorage(app.getPath('userData'));
  ipcMain.handle('notes:load', () => storage.load());
  ipcMain.handle('notes:save', (_e, data) => storage.save(data));
  ipcMain.handle('backup:export', async (_e, data) => {
    const r = await dialog.showSaveDialog({ defaultPath: 'CodeCanvas-backup.json', filters: [{ name: 'JSON backup', extensions: ['json'] }] });
    if (r.canceled) return null;
    await fs.writeFile(r.filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  });
  ipcMain.handle('note:export-pdf', async (_e, note) => {
    if (!note || typeof note.title !== 'string' || !Array.isArray(note.blocks)) throw Error('Invalid note');
    const result = await dialog.showSaveDialog({ defaultPath: `${String(note.title || 'CodeCanvas-note').replace(/[<>:"/\\|?*]+/g, '-').slice(0, 80)}.pdf`, filters: [{ name: 'PDF document', extensions: ['pdf'] }] });
    if (result.canceled || !result.filePath) return null;
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const blocks = note.blocks.map(b => {
      if (b.type === 'code') return `<section class="code"><div class="lang">${escapeHtml(b.language || 'code')}</div><pre>${escapeHtml(b.content || '')}</pre></section>`;
      if (b.type === 'tip') return `<aside><b>NOTE</b><p>${escapeHtml(b.content || '').replace(/\n/g,'<br>')}</p></aside>`;
      if (b.type === 'text') return `<p>${escapeHtml(b.content || '').replace(/\n/g,'<br>')}</p>`;
      if (b.type === 'divider') return '<hr>';
      if (b.type === 'table' && Array.isArray(b.rows)) return `<table>${b.rows.map((r,i)=>'<tr>'+r.map(c=>i===0?`<th>${escapeHtml(c)}</th>`:`<td>${escapeHtml(c)}</td>`).join('')+'</tr>').join('')}</table>`;
      if (b.type === 'image' && /^https?:\/\//i.test(b.url || '')) return `<p><img src="${escapeHtml(b.url)}" style="max-width:100%"></p>`;
      if (b.type === 'drawing') {
        // Convert saved normalized strokes to SVG so drawings are embedded in the PDF.
        const safeColor = value => /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? String(value) : '#7c9cff';
        const strokes = (Array.isArray(b.strokes) ? b.strokes : []).map(s => {
          const pts = (Array.isArray(s.points) ? s.points : []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => ({ x: Math.max(0, Math.min(1, p.x)) * 1200, y: Math.max(0, Math.min(1, p.y)) * 650 }));
          if (!pts.length) return '';
          const color = safeColor(s.color), width = Math.max(1, Math.min(32, Number(s.size) || 3));
          const first = pts[0], last = pts[pts.length - 1];
          const common = `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
          if (s.tool === 'rect') return `<rect x="${first.x}" y="${first.y}" width="${last.x-first.x}" height="${last.y-first.y}" ${common}/>`;
          if (s.tool === 'ellipse') return `<ellipse cx="${(first.x+last.x)/2}" cy="${(first.y+last.y)/2}" rx="${Math.abs(last.x-first.x)/2}" ry="${Math.abs(last.y-first.y)/2}" ${common}/>`;
          let markup = `<polyline points="${pts.map(p => `${p.x},${p.y}`).join(' ')}" ${common}/>`;
          if (s.tool === 'arrow' && pts.length > 1) {
            const prev = pts[pts.length-2], angle = Math.atan2(last.y-prev.y, last.x-prev.x), head = 13 + width;
            const a = {x:last.x-head*Math.cos(angle-.5),y:last.y-head*Math.sin(angle-.5)}, c = {x:last.x-head*Math.cos(angle+.5),y:last.y-head*Math.sin(angle+.5)};
            markup += `<path d="M ${last.x} ${last.y} L ${a.x} ${a.y} M ${last.x} ${last.y} L ${c.x} ${c.y}" ${common}/>`;
          }
          return markup;
        }).join('');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="650" viewBox="0 0 1200 650"><rect width="1200" height="650" fill="white"/>${strokes}</svg>`;
        const image = Buffer.from(svg, 'utf8').toString('base64');
        return `<figure class="drawing"><img alt="Drawing" src="data:image/svg+xml;base64,${image}"><figcaption>Drawing</figcaption></figure>`;
      }
      return '';
    }).join('\n');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:11pt/1.7 Arial,sans-serif;color:#202938}h1{font-size:24pt;line-height:1.25;margin:0 0 6mm} .meta{color:#6b7280;font-size:9pt;margin-bottom:10mm;border-bottom:1px solid #dbe1ea;padding-bottom:4mm}p{white-space:normal;overflow-wrap:anywhere;margin:0 0 5mm}.code{margin:5mm 0;break-inside:avoid;border:1px solid #d7deea;border-radius:5px;overflow:hidden}.lang{background:#edf1f7;padding:2mm 4mm;font:8pt Arial;color:#526079;text-transform:uppercase}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:9pt/1.55 Consolas,monospace;padding:4mm;margin:0;background:#f7f9fc;color:#182438}aside{background:#fff8e8;border-left:3px solid #d9a441;padding:4mm;margin:5mm 0}table{width:100%;border-collapse:collapse;margin:4mm 0}td,th{border:1px solid #d7deea;padding:2mm;text-align:left}th{background:#f0f4fa}hr{border:0;border-top:1px solid #d7deea;margin:7mm 0}.muted{color:#6b7280;font-style:italic}.drawing{margin:5mm 0;break-inside:avoid;text-align:center}.drawing img{display:block;width:100%;max-height:150mm;object-fit:contain;border:1px solid #d7deea;background:#fff}.drawing figcaption{font-size:8pt;color:#6b7280;margin-top:2mm}</style></head><body><h1>${escapeHtml(note.title || 'Untitled note')}</h1><div class="meta">CodeCanvas · ${escapeHtml(note.notebookName || 'Notebook')} · Exported ${new Date().toLocaleDateString()}</div>${blocks}</body></html>`;
    const pdfWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    try { await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)); const data = await pdfWin.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: 0.7, bottom: 0.7, left: 0.7, right: 0.7 } }); await fs.writeFile(result.filePath, data); return true; }
    finally { if (!pdfWin.isDestroyed()) pdfWin.destroy(); }
  });
  ipcMain.handle('backup:import', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON backup', extensions: ['json'] }] });
    if (r.canceled) return null;
    const d = JSON.parse(await fs.readFile(r.filePaths[0], 'utf8'));
    if (!isValidPayload(d)) throw Error('Invalid backup');
    return d;
  });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

