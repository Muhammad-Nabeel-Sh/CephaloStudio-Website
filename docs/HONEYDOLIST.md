# Honeydo List — CephaloStudio

Tracked issues, improvements, and technical debt. Update this file as items are resolved or added.

---

## Statistical Engine Issues

### `src/research/correlation.js`

*No current items.*

### `src/research/comparative.js`

*No current items.*

### `src/research/longitudinal.js`

- **`linearMixedModel()` (line 308)**: Log-likelihood uses OLS formula (`-0.5n*log(2πσ²) - SSE/(2σ²)`) rather than full REML; `ssRes/(2*sigma2)` replaces the simplified `+1` offset. AIC/BIC from this LMM are not directly comparable with RM-ANOVA without proper REML, which would require iterative optimization (EM/Newton).

---

## Data Collection

*No current items.*

---

## UI / Theming

*No current items.*

---

## Performance

- **mathjs bundle**: `vite build` produces a 1.5 MB JS chunk (pre-existing). mathjs is the dominant contributor. Consider dynamic imports or tree-shaking for research-only modules.
- **mathjs bundle**: `vite build` produces a 1.5 MB JS chunk (pre-existing). mathjs is the dominant contributor. Consider dynamic imports or tree-shaking for research-only modules.

---

## Lint / Type Safety

- **Pre-existing warnings** in `src/App.jsx` (9 warnings):
  - `react-hooks/exhaustive-deps` — missing `dispatch` in 7 effect dependencies and 1 useCallback dependency.
  - Not blockers, but could mask stale closure bugs.
- **No TypeScript**: Entire codebase is JSX/JS. No type-checking on function signatures or return types. Errors like the leverage dimension mismatch would have been caught at compile time.

---

## Testing

- **No test infrastructure**: AGENTS.md notes "No tests currently." Adding Vitest would enable regression detection for statistical engines.
- **Snapshot testing**: Research module output is pure JS objects with no serialization. Output structures drift without tests.

---

## Engine Wiring

*No current items.*

---

## Documentation

- **`PREDEFINED_NORMS`** in `descriptive.js`: Only has Steiner, Downs, McNamara norms. Extendable through the config form UI but no programmatic API for user-added presets.
