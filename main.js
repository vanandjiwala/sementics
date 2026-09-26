const { app, BrowserWindow, dialog, ipcMain, session, shell } = require('electron');
const path = require('path');
const duckdb = require('duckdb');

// Run compiled workflow statements in a fresh in-memory DB; report the first failing node.
ipcMain.handle('duckdb:run', async (_event, statements) => {
  const db = new duckdb.Database(':memory:');
  try {
    for (const { nodeId, sql } of statements) {
      try {
        await new Promise((resolve, reject) => db.exec(sql, (err) => (err ? reject(err) : resolve())));
      } catch (err) {
        return { ok: false, nodeId, message: err.message };
      }
    }
    return { ok: true };
  } finally {
    db.close();
  }
});

const CSV_FILTERS = [{ name: 'CSV', extensions: ['csv', 'tsv', 'txt', 'gz'] }, { name: 'All files', extensions: ['*'] }];

ipcMain.handle('dialog:openCsv', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    properties: ['openFile'],
    filters: CSV_FILTERS,
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('dialog:saveCsv', async (event) => {
  const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    filters: CSV_FILTERS,
  });
  return canceled ? null : filePath;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 640,
    icon: path.join(__dirname, 'build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open links to other origins in the OS browser instead of a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, 'dist-renderer/index.html'));
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && !app.isPackaged && app.dock) {
    app.dock.setIcon(path.join(__dirname, 'build/icon.png'));
  }

  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
          ],
        },
      });
    });
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
