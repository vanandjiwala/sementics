const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sementics', {
  runStatements: (statements) => ipcRenderer.invoke('duckdb:run', statements),
  openCsv: () => ipcRenderer.invoke('dialog:openCsv'),
  saveCsv: () => ipcRenderer.invoke('dialog:saveCsv'),
});
