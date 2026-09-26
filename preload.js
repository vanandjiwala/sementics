const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sementics', {
  runStatements: (statements, previewSql) => ipcRenderer.invoke('duckdb:run', statements, previewSql),
  dryRun: (statements, views) => ipcRenderer.invoke('duckdb:dryRun', statements, views),
  openFile: (fileType) => ipcRenderer.invoke('dialog:openFile', fileType),
  saveFile: (fileType) => ipcRenderer.invoke('dialog:saveFile', fileType),
  saveWorkflow: (json) => ipcRenderer.invoke('workflow:save', json),
  openWorkflow: () => ipcRenderer.invoke('workflow:open'),
});
