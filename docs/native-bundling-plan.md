# Native Bundling Plan — Desktop + Mobile

> Status: **planned — not yet implemented**
> Goal: Bundle the Vite web app into desktop (Windows / macOS / Linux) and
> mobile (iOS / Android) apps without rewriting the UI.

---

## 1. Strategy

This is a pure Vite web app (React, canvas, Web Workers, IndexedDB, no native
deps), so the strategy is **wrap the existing build** rather than rewrite.

| Platform | Wrapper | Why |
| --- | --- | --- |
| iOS / Android | **Capacitor** | Runs the built web app in a native WebView; zero React rewrite. Canvas, workers, IndexedDB work as-is. |
| Windows / macOS / Linux | **Tauri v2** (recommended) or Electron | Same web bundle in a native shell. Tauri is far smaller/lighter; Electron if the Node ecosystem is preferred. Compute is already client-side in a worker (`src/research/engine.worker.js`), so no heavy native backend is needed either way. |

PWA remains a bonus distribution channel (already partially set up).

---

## 2. Codebase Changes Required

The real work is hardening a few browser-only assumptions, not rebuilding UI.

1. **Vendor KaTeX CSS** — `src/hooks/useKatex.js` loads CSS from a CDN today;
   that breaks offline in a desktop/mobile bundle. Move to bundled/local CSS.
2. **File I/O** — `showOpenFilePicker` / download-anchor paths don't exist
   everywhere. Add a thin adapter using Capacitor `Filesystem` / `Dialog`
   plugins on mobile, Tauri dialog/fs on desktop, falling back to
   `<input type="file">` + anchor download on web.
3. **Storage** — `imageStore` (IndexedDB) is fine everywhere, but `localStorage`
   for projects can be wiped by OS cache cleaners on desktop. Plan an
   IndexedDB-first migration behind a storage adapter.
4. **Network dependency** — community norms/examples fetched from GitHub must
   become best-effort: bundled default set + long cache, so the app works
   offline.
5. **Platform quirks** — safe-area insets (done for mobile web), keyboard insets
   (done), Fullscreen API no-op on iOS WebView, drag-drop → file-input fallback
   on mobile, `.cephx` file association on desktop.

---

## 3. Suggested Structure

- New `src/capabilities/` module:
  - `openFile()`, `saveFile()`, `readImageFile()`
  - `isCapacitor` / `isTauri` detection
  - graceful web fallbacks
- Route existing import/export/image-loading through it:
  - `src/workspace/images.js`
  - `src/storage/cephxFormat.js`
- Keep **one** `npm run build` as the single source.
- Per-platform scaffolding lives outside `src/`:
  - `capacitor/` project dir
  - `tauri/` project dir

---

## 4. Execution Order

1. Vendor KaTeX CSS + offline defaults for community content.
2. Add `src/capabilities/`; route file open/save/image import through it (the
   web build stays untouched).
3. Storage hardening (IndexedDB-first persistence).
4. Scaffold Capacitor → iOS / Android; fix WebView quirks.
5. Scaffold Tauri v2 → desktop; window config, `.cephx` open-with association.
6. CI: single Vite build, per-platform packaging; code-signing + store
   submission for mobile, notarization if macOS.
7. Manual device matrix + tests.

---

## 5. Cost Considerations (see also response notes)

- **Tooling is free and open source**: Capacitor, Tauri, Electron are all free.
- **Platform costs**:
  - **Apple**: ~\$99/year Apple Developer Program (required for iOS install/signing
    and TestFlight; App Store distribution requires it).
  - **Google**: one-time \$25 Play Store registration for Android.
  - **Windows / macOS / Linux desktop**: no cost for self-distribution. Code
    signing certificates (Windows EV ~\$150–400/yr, Apple Developer already
    covers macOS notarization) are optional but reduce security warnings.
- **Deployment options**:
  - Free: GitHub Releases / your own site hosting the installers.
  - Paid: Microsoft Store (~\$19 one-time), Apple App Store (included in the
    \$99 fee), Steam / winget etc. optional.
- **Total to ship everywhere** ≈ **\$124–\$500/yr**, mostly Apple's annual fee
  plus optional signing certs. Development toolchains (Xcode, Android Studio,
  Rust) are themselves free.

---

## 6. Suggested Next Steps

1. Confirm wrapper choices (Tauri vs Electron; Capacitor for mobile).
2. Start execution order item 1 (vendor KaTeX CSS) — lowest risk, unblocks all
   offline work.
3. Add the `src/capabilities/` adapter incrementally while the web build still
   passes lint + tests.
