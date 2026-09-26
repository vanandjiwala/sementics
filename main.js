const { app, BrowserWindow, dialog, ipcMain, session, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');
const duckdb = require('duckdb');

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const appPageUrl = pathToFileURL(path.join(__dirname, 'dist-renderer/index.html')).href;

// Privileged IPC must come from our own page, not some other frame or navigated-to URL.
const isAppFrame = (event) => {
  const url = event.senderFrame?.url ?? '';
  return devServerUrl ? url.startsWith(devServerUrl) : url === appPageUrl;
};

const isStatements = (statements) =>
  Array.isArray(statements) && statements.every((s) => s && typeof s.nodeId === 'string' && typeof s.sql === 'string');

// Run statements in order; return the first failure as { ok: false, nodeId, message }, else null.
async function execStatements(db, statements) {
  for (const { nodeId, sql } of statements) {
    try {
      await new Promise((resolve, reject) => db.exec(sql, (err) => (err ? reject(err) : resolve())));
    } catch (err) {
      return { ok: false, nodeId, message: err.message };
    }
  }
  return null;
}

// Run compiled workflow statements in a fresh in-memory DB; report the first failing node.
// With previewSql, also run that query afterwards and return its rows.
ipcMain.handle('duckdb:run', async (_event, statements, previewSql) => {
  if (!isStatements(statements) || (previewSql !== undefined && typeof previewSql !== 'string')) {
    return { ok: false, message: 'Invalid request' };
  }

  const db = new duckdb.Database(':memory:');
  try {
    const failed = await execStatements(db, statements);
    if (failed) return failed;
    if (previewSql === undefined) return { ok: true };

    let stmt;
    try {
      stmt = db.prepare(previewSql);
      const rows = await new Promise((resolve, reject) => stmt.all((err, res) => (err ? reject(err) : resolve(res))));
      // columns() is only populated after execution; it still lists headers when there are 0 rows.
      const columns = (stmt.columns() ?? []).map((c) => c.name);
      return { ok: true, preview: { columns, rows: rows.map((r) => columns.map((c) => r[c])) } };
    } catch (err) {
      return { ok: false, nodeId: statements.at(-1)?.nodeId, message: err.message };
    } finally {
      stmt?.finalize();
    }
  } finally {
    db.close();
  }
});

// Bind dry-run statements (views + EXPLAINed outputs) without reading data, then DESCRIBE each view.
ipcMain.handle('duckdb:dryRun', async (_event, statements, views) => {
  const valid =
    isStatements(statements) &&
    Array.isArray(views) &&
    views.every((v) => v && typeof v.nodeId === 'string' && typeof v.name === 'string');
  if (!valid) return { ok: false, message: 'Invalid request' };

  const db = new duckdb.Database(':memory:');
  try {
    const failed = await execStatements(db, statements);
    if (failed) return failed;
    const schemas = {};
    for (const { nodeId, name } of views) {
      try {
        const rows = await new Promise((resolve, reject) =>
          db.all(`DESCRIBE "${name.replaceAll('"', '""')}"`, (err, res) => (err ? reject(err) : resolve(res))),
        );
        schemas[nodeId] = rows.map((r) => ({ name: r.column_name, type: r.column_type }));
      } catch (err) {
        return { ok: false, nodeId, message: err.message };
      }
    }
    return { ok: true, schemas };
  } finally {
    db.close();
  }
});

const ALL_FILES = { name: 'All files', extensions: ['*'] };
const FILE_FILTERS = {
  csv: [{ name: 'CSV', extensions: ['csv', 'tsv', 'txt', 'gz'] }, ALL_FILES],
  json: [{ name: 'JSON', extensions: ['json', 'ndjson', 'jsonl', 'gz', 'zst'] }, ALL_FILES],
};

ipcMain.handle('dialog:openFile', async (event, fileType) => {
  if (!isAppFrame(event) || !Object.hasOwn(FILE_FILTERS, fileType)) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    properties: ['openFile'],
    filters: FILE_FILTERS[fileType],
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (event, fileType) => {
  if (!isAppFrame(event) || !Object.hasOwn(FILE_FILTERS, fileType)) return null;
  const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    filters: FILE_FILTERS[fileType],
  });
  return canceled ? null : filePath;
});

const WORKFLOW_FILTERS = [{ name: 'Sementics workflow', extensions: ['json'] }];

ipcMain.handle('workflow:save', async (event, json) => {
  if (!isAppFrame(event) || typeof json !== 'string') return { ok: false, message: 'Invalid request' };
  const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    defaultPath: path.join(app.getPath('documents'), 'workflow.json'),
    filters: WORKFLOW_FILTERS,
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    await fs.writeFile(filePath, json, 'utf8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

// Only reads the file; the renderer parses and validates it.
ipcMain.handle('workflow:open', async (event) => {
  if (!isAppFrame(event)) return { ok: false, message: 'Invalid request' };
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    properties: ['openFile'],
    filters: WORKFLOW_FILTERS,
  });
  if (canceled || !filePaths.length) return { ok: false, canceled: true };
  try {
    return { ok: true, json: await fs.readFile(filePaths[0], 'utf8'), filePath: filePaths[0] };
  } catch (err) {
    return { ok: false, message: err.message };
  }
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
