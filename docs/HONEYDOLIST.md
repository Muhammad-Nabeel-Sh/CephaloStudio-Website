# Honeydo List — CephaloStudio

Tracked issues, improvements, and technical debt. Update this file as items are resolved or added.

---

## Statistical Engine Issues

### `src/research/correlation.js`

- **`fPval()` (line 90)**: Uses approximation `1 - tCdf(Math.sqrt(F), df2)` instead of proper F-distribution CDF. Crude for small df, negligible for df > 30.
- **`shapiroWilk()` (line 95)**: p-value = `exp(-3.7 * (1 - w) * n)` — valid only for small n (< 50). Proper Royston approximation would be better.
- **`breuschPagan()` (line 123)**: p-value uses t-CDF via `tCdf` instead of χ²(k-1) distribution. Produces slightly conservative p-values.
- **`runLogisticRegression()` (line 498)**: z-tests use t-distribution (`tCdf`) instead of standard normal. Fine for large n but theoretically incorrect.

### `src/research/comparative.js`

- **`studentizedRangeCDF()` (line 290)**: Numerical integration uses only chi-squared PDF in the integrand — simplified for tractability. Tukey HSD p-values are approximate.

### `src/research/longitudinal.js`

- **`linearMixedModel()` (line 308)**: Log-likelihood is OLS-based (`-0.5n(log(2πσ²)+1)`) rather than full REML. AIC/BIC from LMM are not directly comparable with RM-ANOVA. Proper REML would require iterative optimization.

---

## Data Collection

### `src/research/collect.js`

- **Duplicate labels** (line 45): `pivotMeasurements()` overwrites on duplicate `sessionId::label` pairs. Last markup wins silently. Should warn or deduplicate explicitly.
- **Missing unit normalization**: `collectMeasurements()` returns mixed units (`°` for angles, `mm` for lengths) without any flag. Downstream code assumes all values are comparable.

### `src/research/diagnostic.js`

- **Dual binarization logic** (line 456-462): Hybrid numeric threshold + string comparison. Categorical gold standards (e.g., "Class II"/"Class I") fall through to `String(gsVal) === String(goldStandardPositive)` — fragile.

---

## UI / Theming

- **CSS selector in `moduleCharts.jsx`**: Uses inline `<style>` tags with bare class names (`"bar"`, `"roc-line"`). Could conflict with other page elements. Prefix with chart-specific selectors.
- **TabBar component**: iterator variable `t` in `CorrelationPanel.jsx` was renamed (shadowed `theme` prop), but same pattern may exist elsewhere.
- **Responsive charts**: SVG charts in `moduleCharts.jsx` use fixed-width viewBoxes. May overflow on narrow panels. Should use `100%` width.
- **Table text color**: `<th>` color was changed from `t.tx3` to `t.tx` in 5 tables. Ensure remaining tables in `DescriptivePanel.jsx`, `LongitudinalPanel.jsx` also use `t.tx`.

---

## Performance

- **mathjs bundle**: `vite build` produces a 1.5 MB JS chunk (pre-existing). mathjs is the dominant contributor. Consider dynamic imports or tree-shaking for research-only modules.
- **Redundant measurement collection**: Each research module calls `collectMeasurements()` independently. When running multiple studies, measurements are collected from scratch each time. Could cache per session.
- **`shapiroWilk` in `comparative.js`**: Imported from `utils.js` which also has a Shapiro-Wilk implementation. The local version in `correlation.js` is a duplicate. Consider unifying.

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

### `src/research/engine.js`

- **Logistic regression guard** (line 33): `config.threshold != null` triggers logistic regression. 0 is a valid threshold but `0 != null` is `true` — fine. However `""` would also pass. Coerce with `config.threshold !== undefined && config.threshold !== ""`.
- **Error propagation**: `try { ... } catch (e) { return { error: e.message } }` swallows stack traces. In development, consider logging the full error.

---

## Documentation

- **Covariance vs. coordinate keys** (diagnostic.js line 449): The preference for non-`x`/`y` keys is a heuristic. If a measurement's only key is `"x"` or `"y"` (edge case), it gets incorrectly deprioritized.
- **`PREDEFINED_NORMS`** in `descriptive.js`: Only has Steiner, Downs, McNamara norms. Extendable but no mechanism for user-added norms besides the config form.
