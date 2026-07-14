# AGENTS.md - CephaloStudio Development Guide

## Project Overview
CephaloStudio is a React + Vite application for cephalometric analysis (medical imaging analysis).
- **Framework**: React 19 with Vite 8
- **Styling**: Inline styles (no CSS framework)
- **Math**: mathjs for formulas, katex for LaTeX rendering
- **No TypeScript**, **269 tests (Vitest)**

---

## Build / Lint / Dev Commands

```bash
# Development server (hot reload)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview

# Lint entire project
npm run lint

# Run lint on specific files
npx eslint src/App.jsx
npx eslint src/panels.jsx

# Run lint with auto-fix
npm run lint -- --fix
```

**No test framework configured.** If adding tests, use Vitest (matches Vite ecosystem).

---

## Code Style Guidelines

### File Organization
- React components: `.jsx` extension
- Utility functions: `.js` extension
- Main app entry: `src/App.jsx`
- Secondary modules: `src/panels.jsx`
- Entry point: `src/main.jsx`

### Imports
- Use double quotes for imports: `import { useState } from "react";`
- Third-party imports first, then local imports
- Named exports preferred: `export function Foo() {}`
- Default export only for root component: `export default function App()`

### Components
- Use function components (no class components)
- Props destructured in function signature
- Component files use section comments: `// ═══════════════════════════════════════════════════════════════════════════════`
- Helper/utility functions defined before components in same file

### State Management
- `useState` for local state
- `useRef` for DOM refs and mutable values (canvas, file inputs)
- `useCallback` for event handlers passed as props
- `useMemo` for expensive computations
- `useEffect` for side effects (canvas resize, image loading)

### Naming Conventions
- Components: PascalCase (`HomePage`, `Workspace`, `MarkupsPanel`)
- Functions/hooks: camelCase (`useKatex`, `computeMeasurements`)
- Constants: camelCase or SCREAMING_SNAKE_CASE per context
- CSS classes: kebab-case (when used)
- Theme object keys: camelCase (`accent`, `surf2`, `bdr`)

### Theme System
The codebase uses a `THEMES` object with consistent color properties:
```javascript
const THEMES = {
  dark: { name, id, bg, surf, surf2, surf3, bdr, tx, tx2, tx3, acc, acc2, accMuted, err, ok, warn, shadow },
  light: { /* ... */ },
  bluish: { /* ... */ },
};
```
- Always pass theme object as `t` prop
- Use theme colors: `t.acc` (accent), `t.err` (error), `t.ok` (success), `t.warn` (warning)

### Inline Styles
This codebase uses inline styles exclusively:
```jsx
<div style={{ display: "flex", gap: 12, color: t.tx, background: t.surf }}>
  <span style={{ fontSize: 13, color: t.tx2 }}>Text</span>
</div>
```
- Always quote style property values: `"flex"`, not `flex`
- Use theme variables for colors
- Numeric values without units default to pixels
- Use `borderRadius` with numeric values (4, 6, 8, etc.)
- Use `clamp()` for responsive font sizes in style strings

### Error Handling
- Try-catch with empty catch blocks for non-critical operations: `try { ... } catch {}`
- Return `null` from functions that can fail: `catch { return null; }`
- Use optional chaining for nested property access: `calibration?.done`
- Nullish coalescing when needed: `markups || []`

### Canvas/Drawing Code
- Use `ctx.save()` / `ctx.restore()` for drawing state isolation
- Calculate scaled coordinates: `p.x * zoom + pan.x`
- Use `useRef` for canvas element and mutable drawing state
- Debounce expensive redraws with `useCallback`

### MathJS Usage
```javascript
import * as math from "mathjs";
// Compile expressions for safe evaluation
const compiled = math.compile(expression);
const result = compiled.evaluate(scope);
```
- Validate results: check `typeof result === "number"` and `isFinite(result)`
- Build scope from markup measurements using `buildScope()`

### KaTeX Usage
- Load KaTeX CSS via CDN dynamically (see `useKatex` hook)
- Render with `throwOnError: false` to prevent crashes
- Use `output: "html"` for inline rendering

### ID Generation
- Use `uid()` function for generating unique IDs: `Math.random().toString(36).slice(2, 10)`

---

## Project-Specific Patterns

### Markup Data Model
```javascript
{
  id: string,          // unique ID
  type: string,       // "point", "line", "polygon", "angle3", "bezier", etc.
  points: [{x, y}],   // coordinate array
  label: string,      // user-visible label
  color: string,      // hex color
  visible: boolean,
  locked: boolean,
  refLabels: string[], // auto-linked point labels (3px tolerance)
  groupId: string,    // optional group ID for bulk drag
  // type-specific properties (cp for bezier, tangentAngle for tangent, etc.)
}
```

### Calibration
```javascript
{
  done: boolean,
  pxPerMm: number,    // pixels per millimeter
  knownMm: string,
}
```

### Measurement Types
- `length`: distance in mm (calibration-dependent)
- `angle`: degrees (3-point or 4-point, calibration-independent)
- `area`: polygon area in mm²
- `perimeter`: polygon perimeter in mm
- `distance`: perpendicular distance in mm

### Predefined Analyses
Stored in `PREDEFINED` object with keys: `lateral`, `ap`, `other`
Each analysis has `{ name, pts: [{ l, def, color }] }`

---

## File Format
- Projects exported as `.cephx` JSON files with `format: "cephx", version: "2.1"`
- Templates exported as `.cepht` JSON files with `format: "cepht"` — two versions:
  - `version: "1.0"` — definitions only (labels, types, colours, no point coordinates)
  - `version: "2.0"` — definitions + placed point coordinates (full template)

---

## ESLint Configuration
Located in `eslint.config.js`:
- Flat config format (ESLint 9+)
- Extends: recommended JS, react-hooks, react-refresh
- Custom rule: `no-unused-vars` ignores vars starting with `_` or uppercase
- Ignores: `dist/` directory

---

## Common Development Tasks

### Adding a new markup type
1. Add to `TOOLS` array with id, icon, label, key
2. Add rendering logic in `drawMarkup()` function
3. Add measurement logic in `computeMeasurements()` if applicable
4. Add hit-testing in `hitTest()` function
5. Add drawing-in-progress in `drawInProgress()` if multi-point

### Adding a new theme
1. Add entry to `THEMES` object with all color properties
2. Add theme button in header/toolbar

### Modifying formula system
1. Formula evaluation in `panels.jsx`
2. Formula display in `FormulasPanel` component
3. Scope building in `buildScope()` function

### Adding a context menu action
1. Add handler function inside the context menu IIFE in App.jsx
2. Add `item(label, onClick, danger?)` call in the appropriate section
3. Wire through any required state/refs

---

## IDE Configuration (VS Code / Cursor)

Recommended settings for `.vscode/settings.json`:
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "files.associations": {
    "*.jsx": "javascriptreact"
  }
}
```

---

## Progress Summary

### Done
- **Phase 4 — Research Module Framework**: Created `src/research/` with `studyModel.js`, `engine.js`
- **Reliability module**: ICC(2,1) with 95% CI, Bland-Altman, Dahlberg/SEM/MDC, landmark error mapping via 2×2 eigendecomposition — config + results UI (`ReliabilityPanel.jsx`)
- **Descriptive/Normative module**: descriptive stats, reference intervals, z-scores, predefined norms — config + results UI (`DescriptivePanel.jsx`)
- **Comparative module**: test selection (normality+Levene's → route), parametric/non-parametric tests, post-hoc (Tukey HSD/Bonferroni), effect sizes auto-selected, MANOVA — config + results UI (`ComparativePanel.jsx`)
- **Longitudinal module**: RM-ANOVA with Mauchly's sphericity test, GG/HF/LB epsilons, LMM (two-level REML), pairwise Bonferroni — config + results UI (`LongitudinalPanel.jsx`)
- **ResultsDialog**: Floating modal (normogram pattern) with Tables/Charts tabs for all 4 modules
- **Charts module** (`moduleCharts.jsx`): ICC forest plot, Bland-Altman plot, Error map, Distribution+normal curve, Box plots, Group means bar, Effect size forest, P-value dot chart, Longitudinal trajectories, Change score chart
- **`addMarkup()` auto-links refLabels** by detecting matching point labels within 3px tolerance; `refreshAutoMeas()` applies to any `refLabels` bearer regardless of `autoCreated`
- **`syncRefDeps(label, dx, dy)`**: propagates point drags to all dependent markups via `refLabels` — keeps splines, polygons, beziers, circles, ellipses, tangents, arrows attached to their reference points
- **Sessions model** (`session.js`, `project.js`) replacing versions and repro trials
- **Templates**: `.cepht` v2.0 export with point coords, validation, measurement preview, subset editing, localStorage library
- **Session Filmstrip**: floating bottom-center horizontal thumbnail bar (max 5 visible, scrollbar)
- **Batch Import**: multi-image + CSV sidecar parsing
- **App.jsx refactored**: removed dead database mode code, simplified to ~2190 lines
- **Data Integrity & Storage (D1-D8)**:
  - `saveProjects` rewritten: IDB writes awaited before localStorage; failed images kept in envelope (D1); orphan GC on every save (D2); IDB-unavailable / quota banner via custom event (D3)
  - `cephxFormat.js` (new): import validation, v2.0→v2.1 migration, `normalizeSessionImages` shared by import + export (D4); version constants + enhanced `validateCepht` (D5)
  - `loadImage` + `importCephx` reader.onerror paths (D8)
  - Session filmstrip uses Object URLs for thumbnails, not inline base64 (D7)
  - `imageStore.js`: `idbAvailable()` gate, `{ok, error}` return from `storeImageBlob`, `deleteOrphanBlobs` (warm diff + cold scan), `getAllImageKeys`, schema-migration scaffolding in `onupgradeneeded` (D2/D3/D6)
- **23 markup types**: point, line, angle3, angle4, perp, parallel, polygon, curve, ellipse, arc, circle, bezier, tangent, concentric, ruler, ratio, sum, difference, percentage, projDist, text, arrow, midpoint, perp pt, silhouette
- **Bezier CP preservation**: Ctrl+click (add) and Shift+click (remove) preserve existing CPs for unaffected segments; only auto-generate CPs for the 1–2 affected segments
- **Right-click context menu**: Focus, Rename, Change Color, Duplicate, Copy/Paste, Hide/Show, Lock/Unlock, Ref Landmark 1/2, Copy Measurement, Move to Front/Back, Group/Ungroup, Delete, Calibrate, Fit to View, Select All, Toggle Grid
- **Grid overlay**: Toggleable 50px grid on canvas via context menu
- **Group system**: `groupId` property on markups; grouped markups drag together
- **Flash highlight**: Pulsing golden ring (1.5s) when clicking markup from the Markups panel
- **Calibration-aware norms**: `generateInterpretation` skips linear measurement comparison when calibration is not done; units show `px` instead of `mm`; warning banners in InterpretationPanel and MeasurementsPanel
- **Cursor management**: Context-aware cursor (pointer on hoverables, grab for pan, crosshair for drawing tools)

### Build Status
- `npm run build` — OK (chunk size warning is pre-existing, mathjs is large; plotly loaded as dynamic import)
- `npm run lint` — 1 warning in App.jsx only (`react-hooks/exhaustive-deps` for `currentDraw.type`, pre-existing)
