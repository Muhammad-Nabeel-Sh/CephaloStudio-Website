# Cephalometry Studio — Technical Documentation

A web-based cephalometric analysis application for orthodontics and maxillofacial surgery. Built with React 19, Vite 8, and Canvas 2D. Supports image markup, calibration, formula computation, reproducibility studies, batch database analysis, and comprehensive statistical reporting.

---

## 1. Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 (function components, hooks) |
| Build Tool | Vite 8 |
| Rendering | HTML5 Canvas 2D (manual redraw pipeline) |
| Styling | Inline styles (no CSS framework), theme objects |
| Math | mathjs (formula evaluation), custom stats (t-test, ICC, ANOVA, Shapiro-Wilk, regression, etc.) |
| LaTeX | KaTeX (CDN-loaded, lazy) |
| Linting | ESLint 9 flat config, react-hooks, react-refresh |
| Language | JavaScript (JSX), no TypeScript |

---

## 2. Project Structure

```
├── index.html              # Entry HTML, scrollbar suppression
├── vite.config.js          # Vite + React plugin
├── eslint.config.js        # ESLint flat config
├── package.json            # Dependencies and scripts
├── public/                  # Static assets (favicon, icons)
├── Data/                    # CSV reference data (landmark definitions)
├── src/
│   ├── main.jsx             # React entry point (ReactDOM.createRoot)
│   ├── App.jsx              # Root component, Workspace, dashboards (~3200 lines)
│   ├── constants.js         # Themes, tools, predefined analyses, LUT presets, CSV data
│   ├── utils.js             # Math, geometry, statistics, measurement computation
│   ├── markups.jsx          # Markup data models, hit-testing, template parsing
│   ├── panels.jsx           # Side panels (Markups, Formulas, Reproducibility, etc.)
│   ├── ui.jsx               # Reusable UI primitives (Btn, Tag, etc.)
│   ├── FormulasModule.jsx   # Formula editor, KaTeX rendering, formula definitions
│   ├── imageUtils.jsx       # Image processing (brightness, contrast, LUT, edge enhance)
│   └── hooks.jsx            # Custom hooks (useKatex)
```

### Scripts

```bash
npm run dev       # Vite dev server (HMR)
npm run build     # Production build → dist/
npm run preview   # Preview production build
npm run lint      # ESLint check
npm run lint -- --fix  # Auto-fix
```

---

## 3. Architecture Overview

### Component Hierarchy

```
CephalometryStudio (root)
├── HomePage              # Project list, create/import portal
├── PinGate               # PIN authentication for protected projects
└── Workspace             # Main editor
    ├── Toolbar           # Top bar with tools, save, export, theme switcher
    ├── ToolSidebar       # Floating tool palette
    ├── Canvas            # Main canvas area (image + markups rendering)
    ├── RightPanel        # Tabbed side panel
    │   ├── MarkupsPanel
    │   ├── FormulasPanel (from FormulasModule.jsx)
    │   ├── ReproPanel
    │   └── StatisticsPanel
    │       ├── StudyDashboard / DatabaseDashboard
    │       └── MarkupTables
    ├── CalibModal        # Calibration dialog
    ├── TextModal         # Text annotation input
    ├── AnonModal         # Anonymization + PIN
    ├── AlignModal        # Image alignment
    ├── TransformModal    # Transform editor
    └── DatabaseImportModal
```

### State Management

- **Root state**: `projects` array + `activeId` (plain React useState)
- **Workspace state**: zoom, pan, tool, markups, calibration, processing, LUT, selected markup, drawing in progress
- **Undo/Redo**: In-memory stacks of markup snapshots (`undoStackRef`, `redoStackRef`)
- **Auto-save**: Debounced localStorage (500ms), key `"cephalo-autosave"`, cleared on `.cephx` export
- **Project updates**: `updateProject(id, patch)` and `updateVersion(projectId, versionId, patch)` cascade through `setProjects` with `modified` timestamp

### Data Model

```
Project
├── id, name, projection, created, modified
├── meta { patientId, name, dob, age, gender, ... }
├── accessControl { requirePin, pinHash }
├── activeVersionId
├── versions[]
│   ├── id, name, label, timestamp
│   ├── calibration { done, pxPerMm, knownMm }
│   ├── markups[]        ← primary annotation data
│   ├── processing { brightness, contrast, windowWidth, windowCenter, edgeEnhance }
│   ├── lutMode, lutInvert
│   ├── formulas[]       ← { id, expression, label }
│   └── norms[]          ← { label, mean, sd, markupLabel }
└── images[]
    ├── id, name, dataUrl, dx, dy, opacity, blendMode, visible, color
    └── transform { tx, ty, rot, scale }
```

### File Formats

- **`.cephx`**: `{ format: "cephx", version: "2.0", exported, project }`
- **`.cepht`**: `{ format: "cepht", version: "1.0", name, markups[], norms[] }`

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
| `angle3` | 3 | Angle (degrees) | Arc between 3 points |
| `angle4` | 4 | Angle (degrees, 4-point) | Arc between two lines |
| `perp` | 4 | Perpendicular distance | Distance from point to line |
| `polygon` | 3+ | Area (mm²), Perimeter (mm) | Filled polygon |
| `curve` | 2+ | Length (via Catmull-Rom spline) | Smooth curve |
| `text` | 1 | — | Text label at position |
| `ruler` | 2 | Calibration reference | Dashed line (excluded from stats) |

### Drawing Flow

1. User selects tool → `activeTool` set
2. Canvas click → `currentDraw` accumulates points
3. Tool completes → `finalizeMarkup()` creates markup with auto-label
4. Markup added via `addMarkup()` → `updMarkups()` → `updVer()` → `onUpdateVersion()`
5. Undo/redo: `pushUndo()` snapshots markups before each change

### Hit Testing

- Point hit: distance ≤ radius (6px default)
- Line hit: perpendicular distance ≤ tolerance
- Polygon hit: point-in-polygon test
- Curve hit: distance to sampled spline points

---

## 5. Canvas Rendering Pipeline

The canvas is manually managed via `useRef` + `useCallback`:

1. **`redraw()`** (useCallback, line ~1280): Clears canvas, iterates all images and markups
2. **Image rendering**: Applies `getProcessed()` cached result (brightness, contrast, LUT, edge enhance)
3. **Markup rendering**: `drawMarkup()` per type — points, lines, angles, polygons, curves, text
4. **Drawing in progress**: `drawInProgress()` shows temporary geometry
5. **Snap indicators**: Visual cue for snap targets
6. **Scale bar**: Drawn in viewport coordinates
7. **Annotations**: Markup labels rendered at computed positions

**Optimization**: Processed images cached in `procCache` (Map keyed by `${imgId}-${processing}-${lutMode}-${lutInvert}`). Images loaded via `Image()` objects stored in `imgRefs.current`.

---

## 6. Calibration System

Two modes:
1. **Ruler calibration**: User draws ruler markup with known physical length → `pxPerMm = knownMm / rulerPixels`
2. **Manual calibration**: User enters `pxPerMm` directly

Once calibrated (`calibration.done = true`), all measurements convert from pixels to millimeters using `pxPerMm`.

---

## 7. Image Processing Pipeline

Located in `src/imageUtils.jsx`:

| Operation | Parameter | Range |
|-----------|-----------|-------|
| Brightness | `brightness` | -100 to 100 |
| Contrast | `contrast` | -100 to 100 |
| Window/Level | `windowWidth`, `windowCenter` | 0-255 |
| Edge Enhance | `edgeEnhance` | 0-100 (unsharp mask kernel) |
| LUT Mode | `lutMode` | gray, hot, cool, jet, viridis, bone, rainbow |
| Invert | `lutInvert` | boolean |

Processing applied per-image on canvas `ImageData` pixel array. Results cached by composite key to avoid redundant computation.

---

## 8. Formula System

Located in `src/FormulasModule.jsx` and `src/utils.js`:

- **Scope building**: `buildScope(markups, calibration)` creates a variable map from all markup measurements
- **Evaluation**: `evalFormula(expression, scope)` uses `mathjs.compile()` for safe evaluation
- **Display**: KaTeX renders formulas as LaTeX (loaded lazily via CDN)
- **Predefined formulas**: Stored in `FormulasModule.jsx` with `label`, `expression`, `katex` fields
- **Custom formulas**: Users add via editor, stored in `version.formulas[]`
- **Error handling**: Returns `"Error"` on invalid expressions, empty catch blocks for non-critical failures

---

## 9. Predefined Analyses

Defined in `src/constants.js` as `PREDEFINED`:

- **`lateral`**: 10 analyses (General Ceph, Steiner, Ricketts, McNamara, Downs, Bjork, Tweed, Jarv-Bjork, Wits)
- **`ap`**: 6 analyses (Ricketts PA, General PA, Grummons, Hewitt, Svanholt-Solow, Grayson Multiplane)
- **`other`**: Grouped projections (SMV, OPG, TMJ views, Waters, Caldwell, Towne's, Hand-Wrist, CBCT)

Each analysis has `{ name, pts: [{ l, def, color }] }` and optional `{ name, lines: [{ l, def, color }] }`.

Templates can be saved as `.cepht` files and loaded to auto-populate the markup panel with landmark placeholders.

---

## 10. Reproducibility Studies

### Study Types

- **Intra-operator**: Same operator, multiple trials (sessions)
- **Inter-operator**: Multiple operators, each with one or more trials

### Data Collection Mode

1. User creates study, selects landmarks to collect
2. Switches to "collecting" mode — canvas shows numbered points
3. Click landmarks in order → coordinates stored in `study.operators[].trials[].measurements[]`
4. Study marked "completed" when all landmarks collected for all sessions

### Analysis Functions (in `utils.js`)

| Function | Purpose |
|----------|---------|
| `computePerLandmarkError(study, metric, labels)` | Per-landmark mean diff, SD diff, Dahlberg, CV |
| `detectSystematicBias(study, metric, labels)` | Paired t-test between sessions |
| `anovaAcrossSessions(study, metric, labels)` | One-way ANOVA across all sessions |
| `reproIccMatrix(study, metric)` | Builds matrix for ICC calculation |
| `reproPairedVectors(study, metric, pairA, pairB)` | Extracts paired vectors for t-test |
| `reproAllLabels(study)` | Collects all unique landmark labels |

---

## 11. Database Mode

Batch analysis of multiple images:

1. User imports images → `databaseImages[]` array
2. Each image has its own `markups[]`, `calibration`
3. Navigation: `currentImageIndex` cycles through images
4. All markup operations apply to current image
5. **Ruler markups excluded** from statistical calculations

### Database Statistics Dashboard

Tabs: Overview, Descriptive, Grouping, Correlation, Analytics, Export

- **Overview**: Two-column table with image count, variables, landmark coordinates summary
- **Descriptive**: N, Mean, SD, Median, CV%, Min, Max + Shapiro-Wilk normality
- **Grouping**: Per-image grouped statistics
- **Correlation**: Pearson/Spearman matrix with variable selector, heatmap modal (PNG export)
- **Analytics**: 5 sub-tabs — Outliers (IQR/Z-score), Confidence Intervals, Linear Regression, Histograms, Normative Comparison
- **Export**: CSV download of all variables

---

## 12. Statistical Functions (src/utils.js)

### Descriptive Statistics

| Function | Description |
|----------|-------------|
| `mean(arr)` | Arithmetic mean |
| `variance(arr, m)` | Population variance |
| `stdev(arr, m)` | Standard deviation |
| `median(arr)` | Median value |
| `iqr(arr)` | Interquartile range (Q1, Q3, IQR) |
| `skewness(arr)` | Fisher skewness |
| `kurtosis(arr)` | Excess kurtosis |
| `coefficientOfVariation(arr)` | CV as percentage |
| `standardError(arr, icc)` | SEM from ICC |
| `minimalDetectableChange(sem, confidence)` | MDC at 95% (1.96 × √2 × SEM) |

### Statistical Tests

| Function | Description |
|----------|-------------|
| `tTestPaired(arr1, arr2)` | Paired t-test → { t, df, pValue, significant } |
| `calculateICC(values)` | ICC (2,1) absolute agreement, consistency, average |
| `getICCInterpretation(icc)` | Poor (<0.5), Moderate (0.5-0.75), Good (0.75-0.9), Excellent (≥0.9) |
| `dahlbergError(arr1, arr2)` | Random error = √(Σd²/2n) |
| `blandAltman(arr1, arr2)` | Mean diff, SD diff, LoA (±1.96σ) |
| `shapiroWilk(arr)` | Normality test → { W, pValue, normal } |
| `oneWayAnova(...groups)` | ANOVA → { F, dfBetween, dfWithin, pValue, significant } |
| `spearmanCorrelation(arr1, arr2)` | Rank-based correlation |
| `pearsonCorrelation(arr1, arr2)` | Pearson r |
| `correlationMatrix(datasets)` | Full pairwise correlation matrix |
| `aggregateDahlberg(pairedArrays)` | Combined Dahlberg across pairs |
| `detectOutliers(arr, method)` | IQR (1.5×) or Z-score (|z|>3) outlier detection |
| `confidenceInterval(arr, confidence)` | CI for mean using t-distribution |
| `linearRegression(xVals, yVals)` | Slope, intercept, R², p-value, SE, significance |

### Special Functions

| Function | Description |
|----------|-------------|
| `gammaLn(x)` | Log gamma (Lanczos approximation) |
| `betaIncomplete(a, b, x)` | Regularized incomplete beta function |
| `betaCF(a, b, x)` | Continued fraction for beta |
| `tDistributeCDF(t, df)` | Student's t CDF |
| `fCDF(f, d1, d2)` | F-distribution CDF |
| `normalCDF(x)` | Standard normal CDF |
| `normalQuantile(p)` | Inverse normal CDF approximation |

---

## 13. Geometry & Canvas Utilities

| Function | Description |
|----------|-------------|
| `dist(a, b)` | Euclidean distance |
| `angle3pt(p1, vtx, p2)` | 3-point angle (degrees) |
| `angle4pt(p1, p2, p3, p4)` | 4-point angle (degrees) |
| `perpDist(pt, a, b)` | Perpendicular distance from point to line |
| `polyArea(pts)` | Shoelace formula area |
| `polyLen(pts, closed)` | Polygon perimeter |
| `perpPoint(p, a, b)` | Foot of perpendicular from p to line ab |
| `getInfiniteLinePoints(p1, p2, w, h)` | Line extended to canvas bounds |
| `catmullRom(ctx, pts, closed)` | Draw Catmull-Rom spline |
| `sampleSpline(pts, closed, samplesPer)` | Sample B-spline points |
| `splineArea(pts)` | Area under B-spline |
| `splineLen(pts, closed)` | Length of B-spline |
| `snapPoint(ip, markups, r, enabled)` | Snap to nearest markup point |
| `snapToLine(ip, markups, r)` | Snap to nearest line |
| `alignOnePoint(src, dst)` | Translation-only transform |
| `alignTwoPoints(s1, s2, d1, d2)` | Translation + rotation transform |
| `computeMeasurements(m, cal)` | Type-specific measurement computation |
| `vpts(m)` | Filter valid markup points (x > -9000) |

---

## 14. Theme System

Six themes defined in `THEMES` (src/constants.js):

| Theme | ID | Background | Accent | Category |
|-------|-----|-----------|--------|-----------|
| Plasticity | `bluish` | `#0f0f12` | `#a855f7` | Dark (purple) |
| GitHub Dark | `dark` | `#0d1117` | `#58a6ff` | Dark (blue) |
| Mocha | `mocha` | `#37353e` | `#79763b` | Dark (warm) |
| Sage | `sage` | `#d6dac8` | `#6b827c` | Light (green) |
| Paper | `paper` | `#f5f5f5` | `#2563eb` | Light (blue) |
| GitHub Light | `light` | `#e8eaed` | `#06a23d` | Light (green) |

Theme objects provide consistent color keys: `bg`, `surf`, `surf2`, `surf3`, `bdr`, `tx`, `tx2`, `tx3`, `acc`, `acc2`, `accMuted`, `err`, `ok`, `warn`, `shadow`.

Passed as `t` prop to all components: `<Component t={t} />`.

---

## 15. Keyboard Shortcuts

Tool activation via `TOOLS` array (src/constants.js):

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

## 16. Auto-Save System

- **Storage**: `localStorage`, key `"cephalo-autosave"`
- **Data**: `{ projects, activeId, savedAt }` — entire project state serialized
- **Trigger**: Debounced `useEffect` (500ms) fires on any `projects` or `activeId` change
- **Restore**: On app load, `projects` and `activeId` initialized from localStorage if available
- **Clear**: When user exports project as `.cephx`, `localStorage.removeItem("cephalo-autosave")` is called
- **Banner**: Workspace shows "Auto-saved session recovered from before refresh" banner on first load after restore (dismissable)
- **Indicator**: Timestamp display next to Save button ("45s ago"), polled every 3 seconds

---

## 17. LUT (Look-Up Table) Presets

Seven LUT modes in `LUT_PRESETS` (src/constants.js):

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

## 18. Key Implementation Details

### Canvas Sizing
Canvas auto-resizes to container via `ResizeObserver`. DPR-aware: `canvas.width = displayWidth * devicePixelRatio`.

### Undo/Redo
Snapshot-based: `undoStackRef` stores `{ markups: [...] }` before each change. Max depth not capped (memory-limited). `redoStackRef` cleared on new changes.

### Image Stacking
Multiple images layered on canvas with independent `dx`, `dy`, `opacity`, `blendMode`, `transform` per image. Blend modes: `normal`, `multiply`, `screen`, `overlay`.

### Norms Comparison
Users define clinical norms per landmark `{ label, mean (mm), sd (mm) }`. System compares sample mean against norm mean, calculates deviation and z-score, flags if outside ±2SD.

### PIN Protection
Projects can require PIN authentication. PIN stored as SHA-256 hash (`hashPin()`). Verified at project open, cached in `pinVerified` state for session.

---

## 19. Development Conventions

- **Files**: `.jsx` for React components, `.js` for utilities
- **Imports**: Double quotes, third-party first, then local
- **Components**: Function components only, named exports (default only for root)
- **Styling**: Inline styles exclusively, theme variables for all colors
- **Error handling**: Empty catch blocks for non-critical ops, `return null` on failure
- **ID generation**: `uid()` → `Math.random().toString(36).slice(2, 10)`
- **MathJS**: `math.compile(expression)` + `.evaluate(scope)` for safe formula eval
- **Canvas**: `ctx.save()`/`ctx.restore()` for state isolation, scaled coordinates `p.x * zoom + pan.x`

---

## 20. Build Output

```
dist/
├── index.html
├── assets/
│   ├── index-<hash>.css    (~1.8 KB gzipped)
│   └── index-<hash>.js     (~305 KB gzipped)
└── favicon.svg
```

Single JS bundle (no code splitting). Bundle size ~1.1 MB unminified due to mathjs and KaTeX dependencies.

---

## 21. Limitations & Known Constraints

- No TypeScript — all values implicitly typed
- No test framework configured (Vitest recommended if adding tests)
- Undo/redo is in-memory only (not persisted)
- Image data stored as base64 data URLs (memory-intensive for large files)
- Canvas rendering is synchronous (no WebWorker offloading)
- No server-side component — entirely client-side SPA
- Single-user only, no collaboration features
- localStorage auto-save has ~5MB browser limit
