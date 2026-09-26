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
- **Preload** (`preload.js`): currently empty. The renderer has no Node access, so any Node-side work (e.g. `duckdb`, which is a native dependency) must go through IPC exposed here via `contextBridge`.
- **Renderer** (`src/`, ESM, Vite root is `src/`, `base: './'` so it works from `file://`):
  - `App.jsx` owns all workflow state (`useNodesState`/`useEdgesState`). Every node uses the single custom type `workflowNode`; its variant is `data.kind`.
  - `data/nodeCatalog.js` is the registry of node kinds (label, description, icon, accent color). Adding a node type = adding an entry here; the palette, node rendering, and minimap colors all read from it.
  - Palette → canvas drag-and-drop passes the node `kind` via the `application/reactflow` dataTransfer key (`NodePalette.jsx` sets it, `App.jsx#onDrop` reads it).
  - Node execution is currently simulated: `runNode`/`runAll` flip `data.status` (`idle` → `running` → `success`) on a timer. `runNode` is passed to nodes through `data.onRun`.
- **Styling**: Tailwind v4 via `@tailwindcss/vite`; design tokens live in the `@theme` block in `src/index.css` (use `bg-card`, `text-muted-foreground`, etc.). ReactFlow default styles are overridden in the same file.

`duckdb` and `sqlingo` are installed but not yet used anywhere. Of the project's own files, only `main.js`, `preload.js`, and `dist-renderer/` go into the packaged app (`build.files` in `package.json`), so new main-process files must be added there.
