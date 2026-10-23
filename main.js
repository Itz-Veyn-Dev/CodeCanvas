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

