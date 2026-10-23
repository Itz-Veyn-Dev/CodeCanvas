const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('codeCanvas', {
  load: () => ipcRenderer.invoke('notes:load'),
  save: d => ipcRenderer.invoke('notes:save', d),
  exportBackup: d => ipcRenderer.invoke('backup:export', d),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  // Main asks the renderer to flush pending edits; renderer confirms with closeReady().
  onBeforeClose: cb => { ipcRenderer.on('app:before-close', () => cb()); },
  closeReady: () => ipcRenderer.send('app:close-ready')
});
