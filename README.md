# Cephalometry Studio

A web-based cephalometric analysis application for orthodontics and maxillofacial surgery. Built with React 19, Vite 8, and Canvas 2D. Supports image markup, calibration, formula computation, template library, batch import, session metadata management, and four research analysis modules (reliability with guided workflow, descriptive/normative, comparative, longitudinal).

---

## Browser Support

Minimum browser versions required:

| Browser | Version |
|---------|---------|
| Chrome  | 80+     |
| Firefox | 90+     |
| Safari  | 14+     |
| Edge    | 80+     |

Requires ES2020 support, Canvas 2D, and IndexedDB. Not supported in Internet Explorer.

---

## 1. Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 (function components, hooks) |
| Build Tool | Vite 8 |
| Rendering | HTML5 Canvas 2D (manual redraw pipeline) |
| Styling | Inline styles (no CSS framework), theme objects |
| Math | mathjs (formula evaluation), custom stats |
| LaTeX | KaTeX (CDN-loaded, lazy) |
| Testing | Vitest 4 + @testing-library/react, code coverage via v8 |
| CI | GitHub Actions (3 Node versions, lint → test → build) |
| Linting | ESLint 9 flat config, react-hooks, react-refresh |
| Language | JavaScript (JSX), no TypeScript |

---

## 2. Project Structure

```
├── index.html
├── vite.config.js              # Vite + React plugin + Vitest config
├── eslint.config.js
├── package.json
├── .github/workflows/test.yml  # CI pipeline
├── public/
├── Data/                       # CSV reference data
├── src/
│   ├── main.jsx
│   ├── App.jsx                 # Root component (~1380 lines)
│   ├── constants.js            # Themes, tools, predefined analyses, LUT presets
│   ├── utils.js                # Math, geometry, statistics (798 lines, 60+ exports)
│   ├── markups.jsx             # Markup data models, hit-testing, template parsing
│   ├── panels.jsx              # Side panels
│   ├── ui.jsx                  # UI primitives (Btn, Tag, InfoBox, etc.)
│   ├── FormulasModule.jsx      # Formula editor, KaTeX rendering
│   ├── imageUtils.jsx          # Image processing (brightness, contrast, LUT)
│   ├── hooks.jsx               # Custom hooks
│   ├── model/
│   │   ├── session.js          # Session data model (mkSession, duplicateSession, mkReliabilitySession)
│   │   ├── project.js          # Project model with session CRUD, subject CRUD, group/timepoint/operator lists
│   │   └── ...
│   ├── storage/
│   │   └── imageStore.js       # IndexedDB wrapper for image blob storage
│   ├── panels/
│   │   ├── SessionsPanel.jsx   # Session cards, subjects tab, metadata modal trigger
│   │   ├── SessionMetadataModal.jsx  # Spreadsheet-style metadata editor with batch ops, filename parser
│   │   ├── BatchImportModal.jsx
│   │   └── SessionFilmstrip.jsx
│   ├── research/
│   │   ├── studyModel.js       # Study configuration model
│   │   ├── engine.js           # Research engine orchestrator
│   │   ├── reliability.js      # ICC, Bland-Altman, Dahlberg, error mapping
│   │   ├── descriptive.js      # Descriptive stats, reference intervals, z-scores
│   │   ├── comparative.js      # t-tests, ANOVA, MANOVA, post-hoc, test routing
│   │   ├── longitudinal.js     # RM-ANOVA, LMM, sphericity, change scores
│   │   ├── correlation.js      # Correlation analysis
│   │   ├── diagnostic.js       # Diagnostic performance metrics
│   │   ├── ReliabilityPanel.jsx # Config + results UI + guided data collection workflow
│   │   ├── DescriptivePanel.jsx
│   │   ├── ComparativePanel.jsx
│   │   ├── LongitudinalPanel.jsx
│   │   ├── CorrelationPanel.jsx
│   │   ├── DiagnosticPanel.jsx
│   │   ├── ResearchPanel.jsx   # Study list, type selector, per-study config/run/results
│   │   ├── ResultsDialog.jsx   # Floating modal with Tables/Charts tabs
│   │   ├── moduleCharts.jsx    # Chart rendering (ICC forest, Bland-Altman, etc.)
│   │   ├── moduleChartsUtils.jsx
│   │   └── resultsExport.js
│   └── test/
│       ├── setup.js
│       ├── utils.test.js       # 88 tests: geometry, statistics, formulas, ICC
│       ├── MarkupsPanel.test.jsx
│       ├── descriptive.test.js
│       ├── reliability.test.js
│       ├── comparative.test.js
│       └── longitudinal.test.js
```

### Scripts

```bash
npm run dev            # Vite dev server (HMR)
npm run build          # Production build → dist/
npm run preview        # Preview production build
npm run lint           # ESLint check
npm test               # Run tests (Vitest)
npm run test:watch     # Watch mode
npm run test:coverage  # Test + coverage report
```

---

## 3. Architecture Overview

### Component Hierarchy

```
App
├── HomePage              # Project list, create/import portal
├── PinGate               # PIN authentication
└── Workspace             # Main editor
    ├── Toolbar           # Top bar (tools, save, export, theme)
    ├── ToolSidebar       # Floating tool palette
    ├── Canvas            # Image + markup rendering
    ├── Filmstrip         # Session thumbnail bar (bottom)
    ├── RightPanel        # Tabbed side panel
    │   ├── MarkupsPanel
    │   ├── FormulasPanel
    │   ├── ResearchPanel # Tabbed: Reliability / Descriptive / Comparative / Longitudinal
    │   └── ResultsDialog # Floating modal with Tables/Charts tabs
    ├── CalibModal, TextModal, AnonModal, AlignModal, TransformModal
    └── BatchImportModal
```

### State Management

- **Root state**: `projects` array + `activeId` (React useState)
- **Workspace**: zoom, pan, tool, markups, calibration, processing, LUT, selected markup, drawing state
- **Undo/Redo**: In-memory stacks of markup snapshots
- **Auto-save**: Debounced localStorage (500ms), key `"cephalo-autosave"`, cleared on `.cephx` export
- **Project updates**: `updateProject(id, patch)` cascades with `modified` timestamp

### Data Model

```
Project
├── id, name, projection, created, modified
├── meta { patientId, name, dob, age, gender, ... }
├── accessControl { requirePin, pinHash }
├── calibration { done, pxPerMm, knownMm }
├── markups[]              ← primary annotation data
├── processing { brightness, contrast, windowWidth, windowCenter, edgeEnhance }
├── lutMode, lutInvert
├── formulas[]             ← { id, expression, label }
├── norms[]                ← { label, mean, sd, markupLabel }
├── sessions[]             ← replaces old versions model
│   └── { id, name, calibration, markups, processing, ... }
├── images[]
└── templateId
```

### File Formats

- **`.cephx`**: `{ format: "cephx", version: "2.0", exported, project }`
- **`.cepht`** (v2.0): `{ format: "cepht", version: "2.0", name, points: [{ label, type, def, color, coords }], measurements, validation }`

---

## 4. Markup System

### Markup Types

| Type | Points | Measurement | Visual |
|------|--------|-------------|--------|
| `point` | 1 | — | Dot with label |
| `line` / `parallel` | 2 | Length (mm) | Segment with infinite extension |
| `perppoint` | 3 | Perpendicular distance | Point projected onto line |
| `midpoint` | 2 | — | Midpoint dot |
| `arrow` | 2 | Length | Directional arrow |
| `angle3` | 3 | Angle (degrees, signed for ANB) | Arc between 3 points |
| `angle4` | 4 | Angle (degrees, 4-point) | Arc between two lines |
| `perp` | 4 | Perpendicular distance | Distance from point to line |
| `polygon` | 3+ | Area (mm²), Perimeter (mm) | Filled polygon |
| `curve` | 2+ | Length (Catmull-Rom spline) | Smooth curve |
| `text` | 1 | — | Text label at position |
| `ruler` | 2 | Calibration reference | Dashed line (excluded from stats) |

### Drawing Flow

1. User selects tool → `activeTool` set
2. Canvas click → `currentDraw` accumulates points
3. Tool completes → `finalizeMarkup()` creates markup with auto-label
4. Markup added via `addMarkup()` → automatic `refreshAutoMeas()` for dependent measurements
5. Undo/redo: `pushUndo()` snapshots markups before each change

### Hit Testing

- Point hit: distance ≤ radius (6px default)
- Line hit: perpendicular distance ≤ tolerance
- Polygon hit: point-in-polygon test
- Curve hit: distance to sampled spline points

---

## 5. Canvas Rendering Pipeline

Canvas manually managed via `useRef` + `useCallback`:

1. **`redraw()`**: Clears canvas, iterates all images and markups
2. **Image rendering**: `getProcessed()` cached result (brightness, contrast, LUT, edge enhance)
3. **Markup rendering**: `drawMarkup()` per type — points, lines, angles, polygons, curves, text
4. **Drawing in progress**: `drawInProgress()` shows temporary geometry
5. **Snap indicators**: Visual cue for snap targets
6. **Scale bar**: Drawn in viewport coordinates
7. **Annotations**: Markup labels rendered at computed positions

**Optimization**: Processed images cached in `procCache` (Map keyed by `${imgId}-${processing}-${lutMode}-${lutInvert}`). DPR-aware: `canvas.width = displayWidth * devicePixelRatio`. Canvas auto-resizes via `ResizeObserver`.

---

## 6. Calibration System

Two modes:
1. **Ruler calibration**: User draws ruler markup with known physical length → `pxPerMm = knownMm / rulerPixels`
2. **Manual calibration**: User enters `pxPerMm` directly

Once calibrated (`calibration.done = true`), all measurements convert from pixels to millimeters.

---

## 7. Image Processing Pipeline

| Operation | Parameter | Range |
|-----------|-----------|-------|
| Brightness | `brightness` | -100 to 100 |
| Contrast | `contrast` | -100 to 100 |
| Window/Level | `windowWidth`, `windowCenter` | 0-255 |
| Edge Enhance | `edgeEnhance` | 0-100 (unsharp mask kernel) |
| LUT Mode | `lutMode` | gray, hot, cool, jet, viridis, bone, rainbow |
| Invert | `lutInvert` | boolean |

Processing applied per-image on Canvas `ImageData` pixel array. Results cached by composite key.

---

## 8. Formula System

- **Scope building**: `buildScope(markups, calibration)` creates variable map from all markup measurements
- **Evaluation**: `evalFormula(expression, scope)` uses `mathjs.compile()` for safe evaluation
- **Display**: KaTeX renders formulas as LaTeX (loaded lazily via CDN)
- **Predefined formulas**: Stored with `label`, `expression`, `katex` fields
- **Custom formulas**: Users add via editor, stored in `formulas[]`
- **Error handling**: Returns null on invalid expressions, empty catch blocks for non-critical failures

---

## 9. Predefined Analyses

Defined in `src/constants.js` as `PREDEFINED`:

- **`lateral`**: 10 analyses (General Ceph, Steiner, Ricketts, McNamara, Downs, Bjork, Tweed, Jarv-Bjork, Wits)
- **`ap`**: 6 analyses (Ricketts PA, General PA, Grummons, Hewitt, Svanholt-Solow, Grayson Multiplane)
- **`other`**: Grouped projections (SMV, OPG, TMJ views, Waters, Caldwell, Towne's, Hand-Wrist, CBCT)

Each analysis has `{ name, pts: [{ l, def, color }] }` and optional lines. Templates saved as `.cepht` files and loaded to auto-populate the markup panel with landmark placeholders.

---

## 10. Session Metadata Management

Managed via the **Session Metadata Modal** (spreadsheet-style table):

| Feature | Description |
|---------|-------------|
| Field columns | Subject, Group, Timepoint, Patient ID, Operator |
| Dropdowns | Populated from project-level managed lists; "Custom..." for ad-hoc values |
| Batch assign | Select multiple rows (shift-click) → batch action bar applies subject/group/timepoint/operator/patientId |
| Filename parser | Auto-detect delimiters in filenames like `{patient}_{group}_{timepoint}.jpg` with preset patterns |
| Preset buttons | Groups (Treatment/Control/A/B), Timepoints (T0–T5/Baseline/6mo), Operators (Rater 1/2, Reader A/B), Subjects |
| Quick-status | Visual tags per session indicating calibration state, markup count |

Managed value lists stored on the project: `project.groups`, `project.timepoints`, `project.operators`. Study panels consume these via "From Managed" buttons.

---

## 11. Research Modules

Four integrated research modules accessed via the Research Panel. Each follows a config → run → results pattern with a shared `ResultsDialog` for tables and charts. All modules support "From Managed" buttons to consume project-level groups/timepoints/operators.

### Reliability Module (`ReliabilityPanel.jsx` + `reliability.js`)

Guided multi-operator data collection workflow:

| Feature | Description |
|---------|-------------|
| ICC(2,1) | Absolute agreement with 95% CI via Shrout & Fleiss |
| Bland-Altman | Mean bias, LoA, proportional bias regression, CI for limits |
| Dahlberg / SEM / MDC | Random error, standard error of measurement, minimal detectable change |
| Landmark Error Map | Per-landmark centroid, radial error, 95% confidence ellipse from 2×2 eigendecomposition |
| Designs | Intra-operator, inter-operator, method comparison |
| Guided workflow | ▶ Run Study → sequential operator→trial→case steps with progress tracking |
| Clone sessions | Each operator×trial gets a clean session copy (same image, independent markups) |
| Auto-navigate | "Open & Create" creates clone session and navigates to it in the workspace |
| Occasion options | 1–3 trials per operator (single trial for inter-operator) |
| Operator progress | Per-operator bar with done/total counts |

**Workflow flow**: Configure operators/occasions/cases → click "Run Study" → for each step (Operator A / Trial 1 / Case 1, etc.), click "Open & Create" → place markups on clean canvas → "Complete & Next" → auto-advances. After all steps, run analysis for ICC/Bland-Altman/SEM.

### Descriptive / Normative Module (`descriptive.js`)

| Feature | Description |
|---------|-------------|
| Descriptive Stats | N, mean, SD, SEM, variance, min, max, median, Q1, Q3, IQR, percentiles |
| Reference Intervals | Parametric (mean ± 1.96 SD) and non-parametric (order statistics) |
| Z-Scores | Deviation from norm with percentile rank and clinical severity |
| Predefined Norms | Steiner, Downs, McNamara reference values |
| Normality Test | D'Agostino-Pearson from skewness + kurtosis |
| Grouping | By group, operator, or patient |

### Comparative Module (`comparative.js`)

| Feature | Description |
|---------|-------------|
| Test Selection | Routes: normality + Levene's → parametric or non-parametric |
| 2-group tests | Independent t-test, Welch's t-test, Mann-Whitney U, Paired t-test, Wilcoxon signed-rank |
| Multi-group tests | One-way ANOVA, Kruskal-Wallis, Repeated measures ANOVA, Friedman test |
| Post-hoc | Tukey HSD, Bonferroni-corrected pairwise |
| Effect Sizes | Cohen's d, Cohen's dz, rank-biserial r, η², ω², partial η², Kendall's W, epsilon-squared |
| MANOVA | Wilks' lambda, Pillai's trace, Hotelling's trace, Roy's largest root |
| Corrections | Bonferroni, Benjamini-Hochberg |

### Longitudinal Module (`longitudinal.js`)

| Feature | Description |
|---------|-------------|
| RM-ANOVA | Repeated measures ANOVA with Mauchly's sphericity test |
| Corrections | Greenhouse-Geisser, Huynh-Feldt, Lower-bound epsilon |
| LMM | Two-level linear mixed model (random intercept + slope) |
| Pairwise | Bonferroni-corrected paired comparisons |
| Change Scores | Mean change, SD, SEM, MDC, p-value per timepoint pair |
| Model Types | RM-ANOVA only, mixed model, or both |

---

## 12. Sessions & Templates

### Sessions Model

Replaces the old versions system. A project contains multiple sessions, each with its own calibration, markups, and processing state. Sessions are managed through dedicated UI (filmstrip, session selector) and support the full markup lifecycle.

### Templates (.cepht)

- **v2.0** format with point coordinates, measurement preview, subset editing
- **Validation** against predefined analyses
- **Library** stored in localStorage for quick access
- **Export/Import** individual templates or full projects

### Batch Import

Multi-image import with optional CSV sidecar parsing for batch data ingestion.

---

## 13. Sessions Filmstrip

Floating bottom-center horizontal thumbnail bar showing all sessions. Supports quick navigation, add/delete, and visual indicators for calibrated vs. uncalibrated sessions.

---

## 14. Testing & CI

### Test Suite (103 tests, 6 files)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `utils.test.js` | 88 | All geometry, statistics, formulas, ICC, Bland-Altman utilities |
| `MarkupsPanel.test.jsx` | 3 | Component smoke tests |
| `descriptive.test.js` | 3 | `runDescriptiveAll` integration |
| `reliability.test.js` | 3 | ICC computation, Landmark error map |
| `comparative.test.js` | 3 | Test selection routing, multi-group structure |
| `longitudinal.test.js` | 3 | RM-ANOVA, error handling |

### CI Pipeline (`.github/workflows/test.yml`)

Runs on push/PR to main: `npm ci` → `npm run lint` → `npm test` → `npm run build` across Node 18, 20, 22.

### Code Coverage

```bash
npm run test:coverage   # Generates text + lcov + html reports
```

---

## 15. Statistical Engine (src/utils.js)

### Descriptive Statistics

| Function | Description |
|----------|-------------|
| `mean(arr)` | Arithmetic mean |
| `variance(arr, m)` | Sample variance |
| `stdev(arr, m)` | Standard deviation |
| `median(arr)` | Median |
| `iqr(arr)` | Interquartile range (Q1, Q3, IQR) |
| `skewness(arr)` | Fisher skewness |
| `kurtosis(arr)` | Excess kurtosis |
| `coefficientOfVariation(arr)` | CV as percentage |

### Inferential Statistics

| Function | Description |
|----------|-------------|
| `shapiroWilk(arr)` | Shapiro-Wilk normality test |
| `oneWayAnova(...groups)` | One-way ANOVA |
| `tTestPaired(arr1, arr2)` | Paired t-test |
| `calculateICC(values)` | ICC (2,1) with interpretation |
| `calculateICC_CI(icc, n, k)` | ICC confidence interval |
| `dahlbergError(arr1, arr2)` | Dahlberg random error |
| `blandAltman(arr1, arr2)` | Bland-Altman analysis |
| `pearsonCorrelation(arr1, arr2)` | Pearson r |
| `spearmanCorrelation(arr1, arr2)` | Spearman rank correlation |
| `correlationMatrix(datasets)` | Pairwise correlation matrix |
| `linearRegression(xVals, yVals)` | Linear regression with R², p-value |
| `detectOutliers(arr, method)` | IQR or Z-score outlier detection |
| `confidenceInterval(arr, confidence)` | CI for mean |
| `normDeviation(value, norm)` | Z-score and SD interpretation |
| `standardError(arr, icc)` | Standard error of measurement |
| `minimalDetectableChange(sem)` | MDC at 95% confidence |

### Distribution Functions

| Function | Description |
|----------|-------------|
| `gammaLn(x)` | Log gamma (Lanczos) |
| `betaIncomplete(a, b, x)` | Regularized incomplete beta |
| `betaCF(a, b, x)` | Continued fraction for beta |
| `tDistributeCDF(t, df)` | Student's t CDF |
| `fCDF(f, d1, d2)` | F-distribution CDF |
| `normalCDF(x)` | Standard normal CDF |
| `normalQuantile(p)` | Inverse normal CDF |

---

## 16. Geometry & Canvas Utilities

| Function | Description |
|----------|-------------|
| `dist(a, b)` | Euclidean distance |
| `angle3pt(p1, vtx, p2)` | 3-point angle (degrees) |
| `angle4pt(p1, p2, p3, p4)` | 4-point angle (degrees) |
| `perpDist(pt, a, b)` | Perpendicular distance |
| `polyArea(pts)` | Shoelace formula |
| `polyLen(pts, closed)` | Polygon perimeter / polyline length |
| `perpPoint(p, a, b)` | Foot of perpendicular |
| `projectedDistance(ptA, ptB, lineP1, lineP2)` | Signed projection distance |
| `vpts(m)` | Filter valid markup points |
| `snapPoint(ip, markups, r, enabled)` | Snap to nearest point |
| `snapToLine(ip, markups, r)` | Snap to nearest line |
| `computeMeasurements(m, cal)` | Type-specific measurement |
| `catmullRom(ctx, pts, closed)` | Draw Catmull-Rom spline |
| `sampleSpline(pts, closed, samplesPer)` | Sample B-spline points |
| `splineArea(pts)` / `splineLen(pts, closed)` | B-spline area/length |
| `alignOnePoint(src, dst)` / `alignTwoPoints(s1, s2, d1, d2)` | Point alignment |

---

## 17. Theme System

Six themes defined in `THEMES`:

| Theme | ID | Background | Accent |
|-------|-----|-----------|--------|
| Plasticity | `bluish` | `#0f0f12` | `#a855f7` |
| GitHub Dark | `dark` | `#0d1117` | `#58a6ff` |
| Mocha | `mocha` | `#37353e` | `#79763b` |
| Sage | `sage` | `#d6dac8` | `#6b827c` |
| Paper | `paper` | `#f5f5f5` | `#2563eb` |
| GitHub Light | `light` | `#e8eaed` | `#06a23d` |

Theme objects provide consistent color keys: `bg`, `surf`, `surf2`, `surf3`, `bdr`, `tx`, `tx2`, `tx3`, `acc`, `acc2`, `accMuted`, `err`, `ok`, `warn`, `shadow`. Passed as `t` prop.

---

## 18. Keyboard Shortcuts

| Key | Tool |
|-----|------|
| V | Select/Move |
| H | Pan |
| P | Landmark (point) |
| L | Line/Plane |
| J | Perp Point |
| M | Midpoint |
| A | Arrow |
| 3 | Angle 3-pt |
| 4 | Angle 4-pt |
| D | Perp Dist |
| Q | Parallel |
| G | Polygon |
| C | Curve |
| T | Text |
| R | Ruler/Calibrate |

---

## 19. Auto-Save System (Hybrid)

- **Metadata**: `localStorage`, key `"cephalo-autosave"` — project JSON (sessions, markups, configs)
- **Images**: IndexedDB (`CephaloStudioDB`) — image Blobs keyed by image ID, bypassing 5MB localStorage limit
- **Trigger**: Debounced `useEffect` (500ms) on any project state change
- **Restore**: On app load, metadata from localStorage, images loaded lazily from IDB
- **Clear**: On `.cephx` export, `localStorage.removeItem("cephalo-autosave")` + IDB clear
- **Banner**: "Auto-saved session recovered" on first load after restore
- **Indicator**: Timestamp display next to Save button, polled every 3s

---

## 20. LUT Presets

| ID | Name | Color Stops |
|----|------|-------------|
| `gray` | Grayscale | Black → White |
| `hot` | Hot | Black → Red → Yellow → White |
| `cool` | Cool | Cyan → Blue → Magenta |
| `jet` | Jet | Blue → Cyan → Green → Yellow → Red |
| `viridis` | Viridis | Purple → Blue → Green → Yellow |
| `bone` | Bone | Black → Steel Blue → White |
| `rainbow` | Rainbow | Red → Yellow → Green → Cyan → Blue → Magenta |

---

## 21. Build Output

```
dist/
├── index.html
└── assets/
    ├── index-<hash>.css
    ├── index-<hash>.js       (~548 KB gzipped)
    └── plotly.min-<hash>.js  (~1.38 MB gzipped, loaded dynamically)
```

Chart rendering uses Plotly.js loaded as a dynamic import (not in main bundle).

---

## 22. Limitations & Known Constraints

- No TypeScript — all values implicitly typed
- Undo/redo is in-memory only (not persisted across sessions)
- Image data stored as base64 data URLs (memory-intensive for large files)
- Canvas rendering is synchronous (no WebWorker offloading)
- No server-side component — entirely client-side SPA
- Single-user only, no collaboration features
- localStorage auto-save has ~5MB browser limit
- Research module functions (RM-ANOVA, MANOVA) work but some edge cases in repeated-measures data shapes have not been validated on real clinical datasets
