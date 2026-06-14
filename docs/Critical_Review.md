## Architecture

**Monolith persists** — `App.jsx` is still ~3000 lines with 14 inline components (`HomePage`, `Workspace`, `StatisticsPanel`, `StudyMarkupTables`, `FormulaEditor`, `DatabaseImportModal`, `DatabaseDashboard`, several modals, etc.). Each rendering pass recreates all these function objects. studyDashboard.jsx mirrors this pattern with its own inline sub-components. No module boundaries, no lazy loading.

**No data layer** — Everything lives in React state (`wsReducer` + `project`/`onUpdateProject` props). File operations, undo stack, and image processing are all coupled inside Workspace. No separation between state, business logic, and rendering.

**Prop drilling** — Theme `t` is threaded into every component manually. Workspace passes `t`, `formatAngle`, and individual setter wrappers through 3-4 levels of nesting.

---

## Code Quality

**Empty catch blocks** — At least 15 `catch {}` swallowing errors silently. E.g., `evalFormula` in `panels.jsx:231`, image loading handlers, file operations. No error boundaries anywhere.

**ESLint disabled at file level** — `App.jsx` has `/* eslint-disable react-hooks/exhaustive-deps */` and `/* eslint-disable no-unused-vars */` at the top (lines 1-2). These suppress real bugs (stale closures, unused variables). Specific rules should be disabled per-line with justification, not for the whole file.

**Naming** — `updVer` (line 862), `D` (single-letter object e.g. in constants.js), pervasive `m`, `t`, `v`, `s`, `p` throughout. `mean$1` style names indicate past import-collision hacks.

**`formatAngle` bug** — `App.jsx:870`:
```javascript
else if(sign==="reflex")val=Math.abs(v)>180?360-Math.abs(v):360-Math.abs(v);
```
Both branches return the same expression (`360 - Math.abs(v)`). The `reflex` mode is a no-op — never produces a reflex angle.

**Duplicate dashboard files** — `studyDashboard.jsx` has its own `StudyDashboard`, `DatabaseDashboard`, `CohensKappaMatrix`, `BlandAltmanPlot` components that duplicate logic patterns from `App.jsx`'s `StatisticsPanel` and `MarkupTablesPanel`. Two parallel rendering systems for the same data.

---

## Performance

**`redraw` dependencies** — Still 30+ deps in `useCallback` (line 1080). Any state change (even `compareVersionId` or `reproCollecting`) recreates the function. The post-render effect fires every render.

**Image processing cache leak** — `getProcessed` (line 1003-1007) builds keys like `"${imgEntry.id}-${JSON.stringify(processing)}"`. Every slider tick changes `processing` and creates a new canvas element. The cleanup only deletes keys starting with the same image ID — but `Map` grows unbounded if the user adjusts sliders through many values.

**Undo stack** — `pushUndo` serializes the entire `markups` array with `JSON.parse(JSON.stringify(markups))` on every edit. With 50 stack depth and many points, this is wasteful. Could use structured clone or incremental snapshots.

**Double rendering** — Every dispatch triggers a render AND the rAF effect runs `redraw()`. Two canvas paints per state change.

---

## UX

**Accessibility zero** — Canvas has no `role`, `aria-label`, or `aria-describedby`. Tool buttons use emoji/unicode icons (`◉`, `◈`, `∑`) with no `aria-label`. Color is the only selected-state indicator. No screen reader will convey anything meaningful.

**No keyboard nav** — Canvas interactions require a mouse. Tab stops land on panel buttons but the canvas itself has no keyboard handlers beyond `onWheel`. Users can't place or select markups with the keyboard.

**Touch gaps** — Touch handlers exist but `handleTouchStart` hardcodes `{button:0}`, faking a left-click. Right-click/long-press context menus don't work on touch. Hover-based tooltips (`onMouseEnter`/`onMouseLeave`) have no touch equivalent.

**Theme contrast** — `mocha`: `#3e3a3b` text on `#302c2d` background (~1.2:1). WCAG AA requires 4.5:1 for normal text. `sage` and `bluish` have similar issues on `tx3`/`tx2` pairs.

---

## Security

**PIN is obfuscation, not security** — `hashPin` in `utils.js` uses SHA-256 without salt. Same PIN → same hash. A `.cephx` file's hash can be rainbow-tabled. More critically, the PIN gate is client-side only — there's no server to enforce it. Anyone who can read the JS can bypass it.

**CSV injection** — If a markup label starts with `=`, `+`, `-`, or `@`, the CSV export will inject formulas when opened in Excel/LibreOffice. E.g., a landmark named `=CMD` could execute on spreadsheet open.

**`math.evaluate`** — Sandboxed by mathjs but prototype pollution on the scope object is a known theoretical bypass. No `math.create` with restricted scope is used.

---

## Research Module

### Charts (moduleCharts.jsx)
- **Tiny fonts** (6-9px) throughout — illegible on most screens; no hierarchical type scale.
- **Labels truncated** silently with ellipsis — no wrapping / multi-line fallback.
- **No axis titles** on most charts (ICC forest, box plots, CV bar, P-value dot chart, etc.).
- **No proper legends** — corner inline `<text>` instead of boxed legends; colors undocumented.
- **No interactivity** — no tooltips, highlight, zoom, selection; SVG is static.
- **ScatterPairPlot generates fake random data** (`Math.random()` in loop) — placeholder, not real observations.
- **BoxPlotCollective falls back to mean±SD** if `q1/q3` absent, misleading users into thinking they see quartiles.
- **ChangeScoreHeatmap uses raw RGB arithmetic** instead of proper color interpolation.
- **Collective Bland-Altman synthesizes data** from mean±SD rather than plotting real paired differences — a distributional approximation, not an actual Bland-Altman.
- **No chart export** — no download-as-PNG/SVG on any chart card.
- **Every chart duplicates coordinate logic** — `xS`, `yS`, grid lines, labels recalculated per component.

### Studies Section
- **Results not persisted** — in-memory only; vanish on reload (commented as known limitation).
- **No CSV/PDF export** of result tables.
- **No batch operations** — must run/delete studies one at a time.
- **No progress feedback** — all computation is synchronous; UI freezes for large datasets.
- **No data validation** — silent failure: running with zero sessions or labels produces empty tables.
- **No cross-study comparison** — can't compare results across studies or meta-analyze.
- **No power analysis** — no sample size estimation for any study type.
- **No automated narrative** — users must interpret tables/charts manually.

---

## Business

**`"name": "temp-preview"`** in `package.json` — Still signals abandoned experiment. Should be `cephalometry-studio`.

**"Built with AI" section** — Lists 6 AI tools prominently on the landing page. For a medical-measurement tool, this undermines trust. No disclosure of which parts were AI-assisted or whether a domain expert validated the output. Dr. Shaesha's credentials are mentioned once in passing.

**No onboarding** — Blank canvas on first load. Template picker helps but no guided tour, no tooltip hints on tool buttons, no example project shipped. Users must figure out the workflow themselves.

**Unused dependencies** — `package.json` likely has devDependencies never used in production code.

---

## Summary

| Category | Remaining issues |
|----------|-----------------|
| Architecture | Monolith, no modules, prop drilling |
| Code Quality | Empty catches, ESLint disabled, naming, `formatAngle` bug |
| Performance | Redraw deps, cache leaks, undo serialization |
| UX | Zero a11y, no keyboard nav, contrast |
| Security | Unsalted PIN, CSV injection |
| Business | `temp-preview`, AI cred trust, no onboarding |
