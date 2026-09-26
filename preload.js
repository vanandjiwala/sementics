const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sementics', {
  runStatements: (statements, previewSql) => ipcRenderer.invoke('duckdb:run', statements, previewSql),
  openCsv: () => ipcRenderer.invoke('dialog:openCsv'),
  saveCsv: () => ipcRenderer.invoke('dialog:saveCsv'),
});
