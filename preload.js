const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sementics', {
  runStatements: (statements, previewSql) => ipcRenderer.invoke('duckdb:run', statements, previewSql),
  dryRun: (statements, views) => ipcRenderer.invoke('duckdb:dryRun', statements, views),
  openCsv: () => ipcRenderer.invoke('dialog:openCsv'),
  saveCsv: () => ipcRenderer.invoke('dialog:saveCsv'),
  saveWorkflow: (json) => ipcRenderer.invoke('workflow:save', json),
  openWorkflow: () => ipcRenderer.invoke('workflow:open'),
});
