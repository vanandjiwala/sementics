# Sementics

Electron + React (ReactFlow) desktop app.

## Develop

```
npm run dev
```

## Build & package

```
npm run dist:mac    # .dmg + .zip
npm run dist:win    # NSIS installer + portable .exe
```

## Publishing checklist

- **App icon**: add `build/icon.icns` (mac) and `build/icon.ico` (win) — electron-builder
  picks these up automatically. Without them the build ships the default Electron icon.
- **macOS signing + notarization**: required for the app to open without a Gatekeeper
  warning on other machines. Set these env vars before running `dist:mac`:
  - `CSC_LINK` / `CSC_KEY_PASSWORD` — your Developer ID Application certificate (.p12)
  - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` — used by `build/notarize.js`
    to notarize the app after signing
  Without these, `dist:mac` still builds, just unsigned/unnotarized.
- **Windows signing**: set `CSC_LINK` / `CSC_KEY_PASSWORD` to a code-signing certificate
  before running `dist:win`, otherwise installs will trigger a SmartScreen warning.
- Bump `version` in `package.json` before each release build.
