# AGENTS.md - CephaloStudio Development Guide

## Project Overview
CephaloStudio is a React + Vite application for cephalometric analysis (medical imaging analysis).
- **Framework**: React 19 with Vite 8
- **Styling**: Inline styles (no CSS framework)
- **Math**: mathjs for formulas, katex for LaTeX rendering
- **No TypeScript**, **No tests** currently

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
npx eslint src/FormulasModule.jsx

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
- Secondary modules: `src/FormulasModule.jsx`
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
  type: string,       // "point", "line", "polygon", "angle3", etc.
  points: [{x, y}],   // coordinate array
  label: string,      // user-visible label
  color: string,      // hex color
  visible: boolean,
  // type-specific properties...
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
- `length`: distance in mm
- `angle`: degrees (3-point or 4-point)
- `area`: polygon area in mm²
- `perimeter`: polygon perimeter in mm
- `distance`: perpendicular distance in mm

### Predefined Analyses
Stored in `PREDEFINED` object with keys: `lateral`, `ap`, `other`
Each analysis has `{ name, pts: [{ l, def, color }] }`

---

## File Format
- Projects exported as `.cephx` JSON files with `format: "cephx", version: "2.0"`
- Templates exported as `.cepht` JSON files with `format: "cepht", version: "1.0"`

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
1. Formula evaluation in `FormulasModule.jsx`
2. Formula display in `FormulasPanel` component
3. Scope building in `buildScope()` function

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
