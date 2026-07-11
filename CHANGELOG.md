# Changelog

## [1.1.0] - 2026-07-11

### Fixed — Statistical Correctness (Critical)
- `betaCF` broken: missing `d=1/d` inversion + wrong `del=d*h` → `del=d*c`. Restored t/F/χ² correctness app-wide.
- `chi2CDF` upper branch off by factor of x (`a*ln(y)` → `(a-1)*ln(y)`). Normality, Mauchly, Hosmer-Lemeshow now detect violations correctly.
- Kruskal-Wallis & Friedman: replaced `1-fCDF(H,df,1e5)` with `1-chi2CDF(H,df)`. Non-parametric multi-group tests now significant when appropriate.
- `correlation.js` / `diagnostic.js`: replaced local `ibeta` stub with fixed `betaIncomplete`. Pearson/Spearman/regression/ROC p-values now correct.

### Fixed — Data Integrity
- Autosave no longer permanently loses images; IDB writes awaited before localStorage; failed images kept in envelope
- Orphan image blob GC on every save; `deleteOrphanBlobs` warm-diff + cold-scan
- IDB quota/unavailable: custom event fires, user-visible banner
- `importCephx`: version check, field validation, v2.0→v2.1 migration, `normalizeSessionImages` shared by import + export
- `cephxFormat.js`: comprehensive import validation, enhanced `validateCepht`
- `loadImage` + `importCephx`: `reader.onerror` paths added

### Fixed — Privacy & Security
- Auto-save now writes IDB before localStorage to prevent image loss on quota
- `console.error` gated behind `DEV` in clinical paths (App.jsx, imageStore, BatchImportModal)
- Session filmstrip uses Object URLs for thumbnails, not inline base64

### Changed — Mobile Toolbar
- Horizontal scroll row (collapsed bar) + expandable bottom sheet (2-col grid) for mobile
- Double-tap to place point and double-tap to finalize polygon/curve on mobile
- Two-finger tap to cancel placing mode
- Green ✓ "Finish" button in mobile toolbar when drawing polygon/curve
- Filmstrip hidden on mobile (`!isMobile&&` guard)

### Changed — Accessibility (A2, A4, A5, A7, A8)
- `Modal.jsx`: autofocus close button on mount, Tab focus trap, restore previous focus on unmount
- `SessionFilmstrip.jsx`: `role="option"` + `aria-selected` instead of `role="button"`; delete button appears on keyboard focus
- Theme buttons: `aria-pressed={theme===th.id}` on both App.jsx and HomePage.jsx
- Loading overlays: `role="status"` + `aria-live="polite"` on spinner and splash
- Placing-mode card: converted from canvas-drawn to floating React panel with `role="status"`

### Changed — Canvas & Rendering
- `redraw()` + `captureMarkupImage`: null-check `canvas.getContext("2d")`
- `pan` variable removed from React state; reads `panRef.current` (local variable shadow in `redraw`)
- `scheduleRedrawRef` pattern for stable callback from event handlers
- Undo snapshot shape unified: `pushUndo` and `handleMouseUp` both use `{markups, norms, placingMode, placingIdx, placingQueue}`
- Undo/redo: `undoVersion` state counter for reactive button state; fixed redo bug (restores full snapshot)
- `logError()` added to catch blocks in clinical modules

### Changed — Dependencies
- Removed redundant `plotly.js-dist-min` from package.json (kept `plotly.js-basic-dist-min`)
- KaTeX bundled from npm (was CDN-loaded)

### Added — Testing
- `statGoldenValues.test.js`: 18 reference-value regression tests for `fCDF`, `tDistributeCDF`, `chi2CDF`, `betaIncomplete`
- Test count: 103 → 269 (15 test files)
- Coverage thresholds added to vitest config (regression floor: 16% statements, 10% branches, 11% functions, 18% lines)

### Added — Documentation
- CI pipeline: npm audit, CodeQL security analysis, dependency review already present
- Coverage thresholds enforced in `vite.config.js`

### Changed — Documentation
- README: updated project structure, component hierarchy, line counts, test table, CI section, limitations
- CHANGELOG: updated test count to 269, corrected silhouette count to 23
- AGENTS.md: fixed stale `FormulasModule.jsx` reference → `panels.jsx`, updated test count, corrected line counts
- Removed stale docs: `Critical_Review.md`, `cephx_review_report.md`, `HONEYDOLIST.md`, `File Structure.md`

---

## [1.0.0] - 2026-07-03

### Added
- SEO meta tags, Open Graph, Twitter Card, canonical URL, theme-color
- robots.txt, sitemap.xml
- Vercel deployment configuration (SPA rewrites)
- PWA manifest (`site.webmanifest`) with icons
- Apple touch icon link
- Browser support documentation in README
- `onEnter()` keyboard utility in utils.js
- `aria-label` fallback to child text in `Btn` component
- `aria-label` on range slider inputs in `Sld` component
- `role="dialog"`, `aria-modal`, `aria-label`, Escape key handler in `Modal`
- `aria-pressed` on `ToolBtn` component
- `role="button"`, `tabIndex`, keyboard handlers (Enter/Space) on clickable divs
  — MarkupsPanel section headers, markup item selectors, formula LaTeX blocks,
    template cards, portal cards, recent case cards, session thumbnails
- `aria-current="page"` on active session thumbnail
- `aria-label` on toolbar buttons (theme selectors, spotlight, undo/redo,
  zoom in/out, fit to window, right-panel tabs, collapse toggle, delete buttons)

### Changed
- Version bumped 0.0.0 → 1.0.0
- Font `<link>` moved from runtime JSX to `index.html` `<head>`
  with preconnect hints for Google Fonts origins
- ESLint config now ignores `coverage/` directory

### Fixed
- 3 React `exhaustive-deps` warnings in App.jsx (formulas memoized,
  updMarkups wrapped in useCallback, missing deps added to keyboard effect)
- 9 lint errors in `scripts/svg-to-silhouette.js` (unused vars, process global)
- Removed dead `src/App.css` file

---

## [0.5.0] - 2026-06-XX

### Added
- Correlation module (Pearson, Spearman, regression, logistic regression)
  — CorrelationPanel.jsx, correlation.js
- Diagnostic test module (sensitivity, specificity, ROC, AUC, LR+, LR−)
  — DiagnosticPanel.jsx, diagnostic.js
- Results export: CSV download from all research module results
- Plotly-based charts: ICC forest plot, Bland-Altman plot, error map,
  distribution + normal curve, box plots, group means bar, effect size forest,
  p-value dot chart, longitudinal trajectories, change score chart
- `ResultsDialog` with Tables/Charts tabs for all 4 research modules
- `PlotlyChart` wrapper for dynamic Plotly.js loading

### Changed
- Research engine collects measurements across sessions with calibration
- Charts module refactored into `moduleCharts.jsx` + `moduleChartsUtils.jsx`

---

## [0.4.0] - 2026-06-XX

### Added
- Comparative statistics module:
  — Automatic test selection (normality + Levene's → parametric/non-parametric)
  — Independent/dependent t-tests, Mann–Whitney U, Wilcoxon signed-rank
  — One-way ANOVA, Kruskal–Wallis with post-hoc (Tukey HSD, Bonferroni)
  — Effect sizes: Cohen's d, Hedge's g, Glass's delta, rank-biserial, eta-squared
  — MANOVA support
  — ComparativePanel.jsx with config + results UI
- Longitudinal statistics module:
  — RM-ANOVA with Mauchly's sphericity test, GG/HF/LB epsilons
  — Linear mixed model (two-level REML estimation)
  — Pairwise Bonferroni comparisons
  — LongitudinalPanel.jsx with config + results UI
- Descriptive/normative statistics module:
  — Descriptive stats (mean, SD, median, IQR, range, skewness, kurtosis)
  — Reference intervals (90%, 95%, 99%)
  — Z-scores, norm deviation colors
  — Predefined norms integration
  — DescriptivePanel.jsx with config + results UI
- Reliability module:
  — ICC(2,1) with 95% confidence interval
  — Bland-Altman analysis (bias, limits of agreement, heteroscedasticity)
  — Dahlberg error, SEM, MDC
  — Landmark error mapping via 2×2 eigendecomposition
  — ReliabilityPanel.jsx with guided config + results UI

---

## [0.3.0] - 2026-06-XX

### Added
- Sessions data model (`session.js`, `project.js`)
  — Multi-session per project with metadata (subject, group, timepoint)
  — Active session switching, add/duplicate/remove
  — Reliability session creation (operator + trial linked)
- Session Filmstrip: floating bottom-center horizontal thumbnail bar
  — Session thumbnails with image previews
  — Active session highlighting with `aria-current`
  — Add/delete sessions inline
- Batch Import modal
  — Multi-image upload with CSV sidecar file parsing
  — Automatic session creation per row
- Home Page with portal cards (Lateral, AP, Other projections)
  — New Case form (name, patient ID, gender, ethnicity, etc.)
  — Startup Wizard
  — Recent cases grid with summary stats
  — Project import via `.cephx` drag-and-drop / file picker
- Project export/import (`.cephx` format v2.1)
- Template system (`.cepht` format v1.0 / v2.0)
  — Template library from predefined analyses
  — Import/export `.cepht` files
  — Subset editing (select/deselect points)
  — Measurement preview before loading
  — localStorage template library
- Silhouettes system
  — 23 SVG anatomical silhouettes (soft tissue, sella turcica, etc.)
  — Categorized with search
  — Insert as markup objects (positionable, resizable, rotatable)
- Examples panel with built-in example cases

### Changed
- Replaced version-based storage with session-based project model
- App.jsx refactored: removed dead database mode code

---

## [0.2.0] - 2026-05-XX

### Added
- Full canvas rendering pipeline
  — Zoom, pan, mouse coordinate tracking
  — Scaled coordinate system with `toImage`/`toScreen` transforms
  — Image processing: brightness, contrast, window width/center, edge enhancement
  — LUT presets (Gray, Bone, Hot Iron, PET, etc.) with invert
  — Scale bar overlay, LUT legend, snap indicator
  — Displacement vectors between marker sets
  — Airway overlay rendering
  — Annotation sizing control
  — Silhouette handle rendering (resize, rotate)
- 15 markup tools:
  — Select/Move, Pan, Landmark, Midpoint, Line, Parallel, Perp Point,
    Perp Distance, Angle 3-pt, Angle 4-pt, Polygon, Curve (B-Spline),
    Arrow, Text, Ruler
  — Drawing state machine (placement queue, multi-point shapes)
  — Snap-to-grid alignment
  — Replace mode for re-placing landmarks
- Calibration system (known mm → px/mm ratio)
- Measurement system:
  — Distance, angle (3-point and 4-point), polygon area/perimeter,
    perpendicular distance, curve length
  — Angle mode: signed/absolute/reflex × degrees/radians
  — Auto-measurement creation from predefined analyses
  — Composite measurements: ratio, difference, sum, percentage
- Real-time measurement display with norm deviation coloring
- Formula system (`FormulasModule.jsx`):
  — math.js expression editor with variable scope
  — KaTeX LaTeX rendering
  — Pin/unpin to measurements panel
  — Validation and missing variable detection
  — Automatic re-evaluation on scope change
- Predefined analyses for Lateral, AP, and Other projections
  — Landmark definitions with descriptions and default colors
- Undo/redo stack (50 levels)
- Auto-save to localStorage with debounce
- IndexedDB image storage (bypasses 5MB localStorage limit)

---

## [0.1.0] - 2026-05-XX

### Added
- React 19 + Vite 8 project scaffold
- Theme system with 4 themes (Plasticity, GitHub Dark, Paper, GitHub Light)
  — Consistent color tokens (bg, surf, tx, acc, err, ok, warn, etc.)
- Inline-style component library:
  — `Btn` (button with hover/active/danger/ghost variants)
  — `Sld` (range slider with label)
  — `Inp` (text/number input)
  — `PropRow` (label + content row)
  — `Tag` (color-coded badge), `Divider`, `PanelHeader`, `InfoBox`
- Geometry utilities (`utils.js`):
  — Distance, angle, midpoint, perpendicular, polygon area
  — B-Spline sampling, curve length, point alignment
  — Hit-testing for all markup types
  — Snap, clamp, bounding box utilities
- Statistics utilities (`utils.js`):
  — Shapiro-Wilk normality test
  — Levene's test for variance homogeneity
  — One-way ANOVA, F-distribution CDF
  — Paired t-test, Welch t-test, Mann–Whitney U, Wilcoxon signed-rank
  — Spearman/Pearson correlation
  — Bland-Altman analysis, ICC(2,1) with CI
  — Dahlberg error, SEM, MDC
  — Outlier detection (IQR, Z-score, MAD)
  — Confidence intervals, linear regression
  — Norm deviation and Z-score computation
- Clinical interpretation generator (`interpretation.js`)
- PDF report generation via jsPDF + autoTable
- CSV parser for analysis data import
- ESLint flat config with React hooks + refresh plugins
- GitHub Actions CI (Node 18, 20, 22) — lint, test, build
- Vitest test suite with jsdom environment (269 tests)
  — Utility tests (97), stat golden-value tests (18), comparative (18), descriptive (12), anonymize (10), validation (9), distributions (27), imageStore (14), MarkupsPanel, reliability, longitudinal, diagnostic, engine, secureStorage, cephxFormat tests
