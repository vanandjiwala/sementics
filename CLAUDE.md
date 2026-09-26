# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server on :5173 + Electron pointed at it via `ELECTRON_RENDERER_URL` (hot reload for the renderer; restart for `main.js`/`preload.js` changes).
- `npm run build` — Vite build of the renderer into `dist-renderer/`.
- `npm start` — build, then run Electron against the built files.
- `npm run dist:mac` / `npm run dist:win` — package with electron-builder (see README for signing/notarization env vars; `build/notarize.js` runs as `afterSign`).

No test runner or linter is configured.

## Architecture

Electron shell + React/ReactFlow renderer for a visual data-workflow editor ("Sementics").

- **Main process** (`main.js`, CommonJS): creates the window with `contextIsolation`, `sandbox`, no `nodeIntegration`. Loads the dev server URL if `ELECTRON_RENDERER_URL` is set, else `dist-renderer/index.html`. When packaged, injects a strict CSP (`default-src 'self'`) — any remote resource the renderer loads (e.g. the Google Fonts `@import` in `src/index.css`) is blocked in packaged builds.
- **Preload** (`preload.js`): exposes `window.sementics` via `contextBridge`. Each method wraps one `ipcRenderer.invoke` channel handled by `ipcMain.handle` in `main.js`: `runStatements` → `duckdb:run`, `dryRun` → `duckdb:dryRun`, `openCsv` → `dialog:openCsv`, `saveCsv` → `dialog:saveCsv`. The renderer has no Node access; all Node-side work goes through here.
- **Renderer** (`src/`, ESM, Vite root is `src/`, `base: './'` so it works from `file://`):
  - `App.jsx` owns all workflow state (`useNodesState`/`useEdgesState`). Every node uses the single custom type `workflowNode`; its variant is `data.kind`.
  - `data/nodeCatalog.js` is the registry of node kinds (label, description, icon, accent color). Adding a node type = adding an entry here; the palette, node rendering, and minimap colors all read from it.
  - Palette → canvas drag-and-drop passes the node `kind` via the `application/reactflow` dataTransfer key (`NodePalette.jsx` sets it, `App.jsx#onDrop` reads it).
  - Execution: `lib/pipeline.js#buildStatements` compiles the graph (topologically, up to an optional target node) into `{ nodeId, sql }` statements; `App.jsx#execute` sends them to `duckdb:run`, which runs them in a fresh in-memory DuckDB and returns `{ ok }` or `{ ok: false, nodeId, message }`. Node statuses (`idle`/`running`/`success`/`error`) are derived from that. Nodes trigger it via `data.onRun`. Self-check: `node src/lib/pipeline.check.mjs`.
  - Dry run: `buildStatements(..., { dryRun: true })` turns outputs into `EXPLAIN COPY …`; views are lazy, so nothing reads rows (only `read_csv` sniffs headers). `duckdb:dryRun` binds the statements and returns `DESCRIBE` schemas per view; `lib/lineage.js#buildLineage` turns those into column-level lineage via `sqlingo`'s `lineage()` (pass the `DuckDB` dialect class from `sqlingo/duckdb` — the `'duckdb'` string isn't registered). Lineage lives in `App.jsx` state, reaches nodes through `LineageContext`, and is cleared on any graph edit. Self-check: `node src/lib/lineage.check.mjs`.
- **Styling**: Tailwind v4 via `@tailwindcss/vite`; design tokens live in the `@theme` block in `src/index.css` (use `bg-card`, `text-muted-foreground`, etc.). ReactFlow default styles are overridden in the same file.

Of the project's own files, only `main.js`, `preload.js`, and `dist-renderer/` go into the packaged app (`build.files` in `package.json`), so new main-process files must be added there.

## Electron rules

Based on the [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security) and [process model](https://www.electronjs.org/docs/latest/tutorial/process-model) docs.

- **Keep the window locked down.** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity` left at default. Never enable `allowRunningInsecureContent`, `enableBlinkFeatures`, `experimentalFeatures`, or `<webview>`.
- **Preload exposes narrow, named functions only.** Never expose `ipcRenderer` itself, a generic `send(channel, ...)`/`invoke(channel, ...)` passthrough, or `ipcRenderer.on` callbacks that receive the raw `event`. If main→renderer events are needed, expose `onX(cb)` that forwards only the payload and returns an unsubscribe.
- **IPC is async request/response.** Use `ipcRenderer.invoke` + `ipcMain.handle`; no `sendSync`. Channel names are `domain:action`. Add the handler in `main.js` and its wrapper in `preload.js` in the same change.
- **Treat IPC input as untrusted.** Validate argument shape/types in each handler, and check `event.senderFrame.url` is the app's own page (dev server URL or the `file://` `dist-renderer/index.html`) before doing privileged work.
- **Know what `duckdb:run` grants.** It executes renderer-supplied SQL, which can read/write any file the user can. That is by design, and it's why the renderer must never load remote/untrusted content: an XSS in the renderer = arbitrary file access.
- **Return errors as data.** Handlers return `{ ok: false, message }` (see `duckdb:run`) rather than throwing across IPC; callers in the renderer still wrap `invoke` in try/catch.
- **No navigation, no stray windows.** Deny `window.open` (already done via `setWindowOpenHandler`) and block `will-navigate` to anything but the app page. Only pass `http:`/`https:` URLs to `shell.openExternal` — parse with `new URL()` and check `protocol` first (the current handler does not yet).
- **CSP stays strict.** Packaged builds enforce `default-src 'self'`. Bundle fonts/assets locally instead of loading from CDNs, and never loosen the CSP to make something work.
- **Don't block the main process.** No sync `fs`/`child_process` calls or long loops in `main.js`; a blocked main process freezes every window. If DuckDB jobs get heavy or crash-prone, move them to a `utilityProcess` rather than `child_process.fork`.
- **Release native resources.** Close DuckDB handles in `finally` (as `duckdb:run` does); don't hold global connections without a clear lifecycle.
- **Stay on a supported Electron.** Only the latest three majors get security fixes; bump Electron deliberately and re-test packaging (native modules) when you do.

## Node / packaging rules

- `main.js`/`preload.js` are CommonJS (`require`); `src/` is ESM bundled by Vite. Don't import Node or Electron modules from `src/`.
- Anything `main.js` requires at runtime must be in `dependencies`, not `devDependencies`, or it's missing from the packaged app. Renderer-only packages are bundled by Vite either way.
- `duckdb` is a native module and must match Electron's ABI. electron-builder rebuilds it and unpacks it from `app.asar` automatically; if it fails to load only in packaged builds, check `asarUnpack` and the rebuild step first.
- Build paths with `path.join(__dirname, ...)` (Windows is a target). Never write to `__dirname`/the app bundle; persistent app data goes in `app.getPath('userData')`.
- Check `app.isPackaged` for dev-vs-prod behavior, not `NODE_ENV`.
- No secrets in the repo. Signing/notarization credentials come from env vars only (see README).
